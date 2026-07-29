export const CODE_ROLE_SIGNATURES = Object.freeze({
  version: 1,
  signatures: Object.freeze([]),
});

export function codeContextFromUrl(value) {
  let url;
  try {
    url = value instanceof URL
      ? value
      : new URL(typeof value === "string" ? value : value?.href);
  } catch {
    return null;
  }
  if (url.origin !== "https://claude.ai") return null;
  const parts = url.pathname.split("/").filter(Boolean);
  if (parts[0] !== "code") return null;
  return parts.length === 1 ? "code-list" : "code-session";
}

export function createInertCodeAdapter() {
  const native = (reason = "signature-unregistered") => ({
    status: "native",
    reason,
    signature: null,
  });
  return {
    activate: () => Promise.resolve(native()),
    rollback: native,
  };
}

export function createCodeAdapter(environment = {}, descriptor = null) {
  const document = environment.document;
  const requestFrame = environment.requestAnimationFrame
    ?? ((callback) => setTimeout(() => callback(Date.now()), 0));
  const cancelFrame = environment.cancelAnimationFrame ?? clearTimeout;
  const now = environment.now ?? (() => globalThis.performance?.now?.() ?? Date.now());
  const getNavigationKey = environment.getNavigationKey ?? (() => "");
  const getContext = environment.getContext ?? (() => null);
  const MutationObserverClass = environment.MutationObserver ?? globalThis.MutationObserver;
  const getComputedStyle = environment.getComputedStyle ?? globalThis.getComputedStyle;
  const registry = descriptor ?? { version: 1, signatures: [] };
  const rootMarker = "data-claude-aura-code-root";
  const versionMarker = "data-claude-aura-code-version";
  const roleMarker = "data-claude-aura-code-role";
  const styleId = "claude-aura-code-style";
  const probeKinds = ["semantic", "aria", "data", "structural"];
  let active = null;
  let pendingFrame = null;
  let pendingResolve = null;
  let pendingSignature = null;
  let mutationFrame = null;
  let observer = null;
  let stopRoute = null;
  let generation = 0;
  let lastFullDiscovery = -Infinity;

  const outcome = (status, reason, signature = null) => ({
    status,
    reason,
    signature: signature?.id ?? null,
  });
  const validSignature = (entry) => {
    if (!entry || !/^[a-z0-9-]{1,64}$/.test(entry.id)
        || !["code-list", "code-session"].includes(entry.context)
        || !orderedProbes(entry.rootProbes) || !Array.isArray(entry.roles)) return false;
    const names = new Set();
    return entry.roles.every((role) => {
      const valid = /^[a-z0-9-]{1,64}$/.test(role?.name)
        && /^[a-z0-9-]{1,64}$/.test(role?.group)
        && !names.has(role.name) && orderedProbes(role.probes);
      names.add(role?.name);
      return valid;
    });
  };
  const signaturesFor = (context) => registry.version === 1 && Array.isArray(registry.signatures)
    ? registry.signatures.filter((entry) => entry?.context === context && validSignature(entry))
    : [];
  const signatureFor = (context) => {
    const matches = signaturesFor(context);
    return matches.length === 1 ? matches[0] : null;
  };
  const orderedProbes = (probes) => {
    if (!Array.isArray(probes) || probes.length === 0) return false;
    let previous = -1;
    for (const probe of probes) {
      const index = probeKinds.indexOf(probe?.kind);
      if (index < previous || index < 0 || typeof probe.selector !== "string"
          || !probe.selector || probe.selector.length > 240) return false;
      previous = index;
    }
    return true;
  };
  const probe = (scope, probes) => {
    if (!orderedProbes(probes) || !scope?.querySelectorAll) return [];
    for (const entry of probes) {
      let matches;
      try {
        matches = [...scope.querySelectorAll(entry.selector)];
      } catch {
        return [];
      }
      if (matches.length) return [...new Set(matches)];
    }
    return [];
  };
  const inspect = (element, root) => {
    const rect = element?.getBoundingClientRect?.();
    const computed = element && getComputedStyle?.(element);
    const visible = Boolean(element?.isConnected && rect
      && rect.width > 0 && rect.height > 0
      && computed?.display !== "none" && computed?.visibility !== "hidden");
    const names = element?.getAttributeNames?.() ?? [];
    return {
      element,
      cardinality: element ? 1 : 0,
      stableAttributes: names.filter((name) =>
        name === "role" || name.startsWith("aria-") || name.startsWith("data-")).sort(),
      geometry: rect ? {
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
      } : null,
      visible,
      contained: Boolean(root?.contains?.(element)),
    };
  };

  const discover = (context, signature = signatureFor(context), groups = null) => {
    const startedAt = now();
    const navigationKey = getNavigationKey();
    if (!document || !signature || !orderedProbes(signature.rootProbes)) {
      return { context, signature, navigationKey, startedAt, reason: "signature-unregistered" };
    }
    const roots = probe(document, signature.rootProbes);
    const root = roots.length === 1 ? roots[0] : null;
    const roles = new Map();
    for (const role of Array.isArray(signature.roles) ? signature.roles : []) {
      if (groups && !groups.has(role.group)) continue;
      const matches = root ? probe(root, role.probes) : [];
      roles.set(role.name, {
        definition: role,
        matches,
        candidates: matches.map((element) => inspect(element, root)),
      });
    }
    return {
      context,
      signature,
      navigationKey,
      startedAt,
      elapsedMs: now() - startedAt,
      rootMatches: roots,
      root: inspect(root, root),
      roles,
    };
  };

  const validate = (discovery, groups = null) => {
    if (!discovery?.signature || discovery.elapsedMs > 8
        || discovery.rootMatches?.length !== 1 || !discovery.root?.visible) {
      return outcome("native", discovery?.elapsedMs > 8 ? "discovery-budget" : "signature-mismatch");
    }
    const selected = new Map();
    for (const [name, record] of discovery.roles) {
      const role = record.definition;
      if (groups && !groups.has(role.group)) continue;
      const valid = record.candidates.filter((candidate) =>
        candidate.visible && candidate.contained);
      if (role.safetySensitive && valid.length > 0) {
        return outcome("native", "safety-role-detected");
      }
      if (valid.length > 1) return outcome("native", "role-ambiguous");
      if (role.required && valid.length !== 1) {
        return outcome("native", "required-role-mismatch");
      }
      if (valid.length === 1) selected.set(name, valid[0].element);
    }
    return {
      status: "valid",
      reason: "signature-valid",
      signature: discovery.signature.id,
      selected,
    };
  };

  const prepare = (discovery, validation) => {
    if (validation?.status !== "valid" || !document?.createElement) return null;
    if (document.getElementById?.(styleId)) return null;
    const style = document.createElement("style");
    style.id = styleId;
    style.setAttribute("data-claude-aura-owned", String(registry.version));
    const markerPlan = new Map();
    const addRole = (element, role) => {
      const roles = markerPlan.get(element) ?? [];
      roles.push(role);
      markerPlan.set(element, roles);
    };
    for (const [name, element] of validation.selected) addRole(element, name);
    const rules = [];
    for (const role of discovery.signature.roles ?? []) {
      if (!validation.selected.has(role.name) || typeof role.css !== "string"
          || role.css.includes("{") || role.css.includes("}")) continue;
      rules.push(
        `[${rootMarker}="${discovery.signature.id}"][${versionMarker}="${registry.version}"]`
        + ` [${roleMarker}~="${role.name}"]{${role.css}}`,
      );
    }
    style.textContent = rules.join("\n");
    return {
      discovery,
      style,
      markerPlan,
      snapshots: [],
      inlineSnapshots: [],
    };
  };

  const restoreAttribute = ({ element, name, present, value }) => {
    if (!element) return;
    if (present) element.setAttribute(name, value);
    else element.removeAttribute(name);
  };
  const rollback = (reason = "rollback") => {
    generation += 1;
    if (pendingFrame !== null) cancelFrame(pendingFrame);
    if (mutationFrame !== null) cancelFrame(mutationFrame);
    pendingFrame = mutationFrame = null;
    const resolvePending = pendingResolve;
    const unresolvedSignature = pendingSignature;
    pendingResolve = pendingSignature = null;
    observer?.disconnect?.();
    observer = null;
    stopRoute?.();
    stopRoute = null;
    const transaction = active;
    active = null;
    for (const snapshot of [...(transaction?.snapshots ?? [])].reverse()) restoreAttribute(snapshot);
    for (const snapshot of [...(transaction?.inlineSnapshots ?? [])].reverse()) {
      if (snapshot.present) {
        snapshot.element.style.setProperty(snapshot.name, snapshot.value, snapshot.priority);
      } else snapshot.element.style.removeProperty(snapshot.name);
    }
    transaction?.style?.remove?.();
    const orphan = document?.getElementById?.(styleId);
    if (orphan?.getAttribute?.("data-claude-aura-owned") === String(registry.version)) {
      orphan.remove?.();
    }
    const result = outcome(
      "native",
      reason,
      transaction?.discovery?.signature ?? unresolvedSignature,
    );
    resolvePending?.(result);
    return result;
  };

  const snapshotAndSet = (transaction, element, name, value) => {
    transaction.snapshots.push({
      element,
      name,
      present: element.hasAttribute(name),
      value: element.getAttribute(name),
    });
    element.setAttribute(name, value);
  };
  const revalidateGroups = (transaction, groups) => {
    const discovery = discover(
      transaction.discovery.context,
      transaction.discovery.signature,
      groups,
    );
    return discovery.navigationKey === transaction.discovery.navigationKey
      && validate(discovery, groups).status === "valid";
  };
  const observe = (transaction) => {
    if (!MutationObserverClass) return;
    observer = new MutationObserverClass((records) => {
      const groups = new Set();
      let unknown = false;
      for (const record of records) {
        let matched = false;
        for (const role of transaction.discovery.signature.roles ?? []) {
          const element = transaction.validation.selected.get(role.name);
          if (element && (element.contains?.(record.target) || record.target?.contains?.(element))) {
            groups.add(role.group);
            matched = true;
          }
        }
        if (!matched) unknown = true;
      }
      if (mutationFrame !== null) return;
      mutationFrame = requestFrame(() => {
        mutationFrame = null;
        if (active !== transaction) return;
        if (unknown) {
          if (now() - lastFullDiscovery < 1000) return;
          lastFullDiscovery = now();
          groups.clear();
          for (const role of transaction.discovery.signature.roles ?? []) groups.add(role.group);
        }
        if (groups.size && !revalidateGroups(transaction, groups)) rollback("mutation-invalid");
      });
    });
    observer.observe(transaction.discovery.root.element, {
      childList: true,
      subtree: true,
      attributes: true,
    });
  };

  const activate = (context = getContext()) => {
    const signature = signatureFor(context);
    if (!signature) return Promise.resolve(rollback("signature-unregistered"));
    if (active?.discovery?.context === context
        && active.discovery.navigationKey === getNavigationKey()
        && active.discovery.signature === signature) {
      return Promise.resolve(outcome("styled", "already-committed", signature));
    }
    rollback("replace");
    const discovery = discover(context, signature);
    const validation = validate(discovery);
    if (validation.status !== "valid") return Promise.resolve(validation);
    const transaction = prepare(discovery, validation);
    if (!transaction) return Promise.resolve(outcome("native", "prepare-failed", signature));
    transaction.validation = validation;
    const currentGeneration = generation;
    return new Promise((resolve) => {
      pendingResolve = resolve;
      pendingSignature = signature;
      pendingFrame = requestFrame(() => {
        pendingFrame = null;
        pendingResolve = pendingSignature = null;
        if (generation !== currentGeneration
            || getNavigationKey() !== discovery.navigationKey
            || getContext() !== context
            || signatureFor(context) !== signature
            || now() - discovery.startedAt > 100) {
          transaction.style.remove?.();
          resolve(outcome("native", "route-changed", signature));
          return;
        }
        try {
          (document.head || discovery.root.element).appendChild(transaction.style);
          snapshotAndSet(transaction, discovery.root.element, rootMarker, signature.id);
          snapshotAndSet(transaction, discovery.root.element, versionMarker, String(registry.version));
          for (const [element, roles] of transaction.markerPlan) {
            snapshotAndSet(transaction, element, roleMarker, roles.join(" "));
          }
          active = transaction;
          observe(transaction);
          stopRoute = environment.addRouteListener?.(() => {
            if (getNavigationKey() !== discovery.navigationKey || getContext() !== context) {
              rollback("route-changed");
            }
          }) ?? null;
          resolve(outcome("styled", "committed", signature));
        } catch {
          active = transaction;
          resolve(rollback("commit-failed"));
        }
      });
    });
  };

  return {
    activate,
    discover,
    validate,
    prepare,
    rollback,
    getState: () => active
      ? outcome("styled", "committed", active.discovery.signature)
      : outcome("native", "inactive"),
  };
}
