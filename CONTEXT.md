# Claude Aura Work Management

This context names the local work-management concepts shared by Claude Aura Web
and Claude Aura Desktop.

## Language

**Work Hub**:
The default Tasks landing view that helps a user find the work to continue or
review and exposes one clear next action. Summaries and metrics are secondary.
_Avoid_: Analytics dashboard, reporting dashboard

**Linked Session**:
A provider thread that the user explicitly attached to a task. Aura may show
the link as local, a separately verified provider observation as active, or an
explicitly evidenced terminal state. For ordinary `claude.ai`, **Terminated —
usage limit** is recorded only after the user reports seeing that outcome; it
does not complete the task or prove provider acceptance of queued work.
_Avoid_: Discovered session, inferred run, completed task

**Session Evidence Event**:
The body-free activity record appended whenever a linked session changes state.
It records task, time, prior state, next state, and `local`, `user-reported`, or
`provider-observed` evidence. The task stores the latest projection and terminal
reason. A user-reported event is not a provider receipt.
_Avoid_: Provider acknowledgement, completion receipt, inferred lifecycle

**Action Queue**:
The ordered set of next-message drafts the user intends to place into selected
local targets. It makes local intent and the next available action visible; it
does not imply that a provider accepted, started, or completed anything.
_Avoid_: Prompt Shelf, task list, automatic runner

**Next-message Draft**:
The editable message prepared for a task before it is sent. It may be added to
the Action Queue for one selected target, but remains unsent until the user
reviews and sends it.
_Avoid_: Saved prompt, queued task, submitted message

**Queue Item**:
One ordered intention in the Action Queue, linking a next-message draft to its
selected target and current evidence stage. A queue item is not the task itself.
After manual Send, the user explicitly confirms **Sent - next** to archive that
local intention and reveal the next item; Aura does not infer this transition.
_Avoid_: Task, conversation, completed run

**Saved Prompt**:
Reusable or legacy text that is not attached to a task or target. It becomes a
next-message draft only when the user chooses to use it for active work.
_Avoid_: Queue item, active task

**Needs Attention**:
A Work Hub queue containing tasks with an explicit needs-input, ready-for-review,
or blocked state. Membership comes from task state, not recency.
_Avoid_: Recent, notifications

**Needs Input**:
A task state meaning progress is waiting for an explicit answer or decision
from the user. It is not inferred from inactivity, provider content, or age.
_Avoid_: Stale, maybe blocked

**Recent Task**:
A task the user explicitly opened in Aura, ordered by its last-opened time.
Background activity and passive updates do not make a task recent.
_Avoid_: Recently updated task, trending task

**Tab**:
A persistent navigation slot for a first-class Aura destination the user
explicitly opened. Its destination may be the Work Hub, a project, a task, a
Studio page, or another supported target; background activity cannot create it,
normal repeat opens focus it, and only an explicit action may duplicate it.
_Avoid_: Task tab, project tab

**Unavailable Tab**:
A restored tab whose destination cannot currently be resolved. It stays in its
saved position and shows recovery actions instead of silently disappearing or
opening a different destination.
_Avoid_: Broken tab, dead tab

**Side Panel**:
The persistent navigation surface for major Aura areas and task-retrieval
routes. It helps users find destinations; tabs preserve destinations they have
already opened.
_Avoid_: Tab list, dashboard menu
