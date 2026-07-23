// WO-18 Aura Studio visual theme editor. Host access stays in app.js.
(() => {
  "use strict";

  const STRINGS = {
    en: {
      navEditor: "Theme editor",
      editorKicker: "No-code theme editor",
      historyActions: "Edit history",
      undo: "Undo",
      redo: "Redo",
      resetChanges: "Reset",
      backToThemes: "Back to themes",
      themeIdentity: "Theme name",
      themeIdentityHelp: "Name the theme for each language you want to support.",
      themeNameEn: "English name",
      themeNameZhCn: "Simplified Chinese name",
      themeNameZhTw: "Traditional Chinese (Taiwan) name",
      themeDescriptionEn: "English description",
      themeDescriptionZhCn: "Simplified Chinese description",
      themeDescriptionZhTw: "Traditional Chinese (Taiwan) description",
      editAppearance: "Theme mode",
      lightMode: "Light",
      darkMode: "Dark",
      copyLightToDark: "Copy Light colors to Dark",
      copyDarkToLight: "Copy Dark colors to Light",
      modeHelp: "Light and Dark can use different colors and images.",
      colorsAndSurfaces: "Colors",
      colorsHelp: "Choose essential colors in Quick customize. Advanced also includes supporting colors and exact values.",
      typographyAndMaterials: "Type and effects",
      studioStyleHelp: "These type, corner, blur, and shadow choices style Aura and Studio together.",
      appIdentity: "App identity",
      appIdentityHelp: "Replace the mark used by Aura, Studio, the launcher, taskbar, and tray, or style its surrounding control. Choose a static, transparent 96 × 96 PNG.",
      appIdentityPreview: "App identity preview",
      selectAppIdentityPreview: "Select app identity",
      replaceAppMark: "Replace mark",
      launcherSurface: "Mark background",
      launcherSurfaceHover: "Hover background",
      launcherForeground: "Label and grip",
      launcherAccent: "Identity accent",
      launcherBorder: "Identity border",
      launcherRadius: "Identity roundness",
      launcherBorderWidth: "Border width",
      interfaceFont: "Interface font",
      displayFont: "Heading font",
      cornerRadius: "Corner radius",
      themeOriginal: "Theme original",
      inheritedRadiusHelp: "Theme original. Moving this control creates one shared corner radius.",
      surfaceBlur: "Panel blur",
      softShadow: "Shadow",
      themeBackground: "Theme background",
      backgroundScope: "Background area",
      contentCanvas: "Main area only",
      fullWindow: "Entire window",
      contentScopeHelp: "Artwork begins after the live sidebar.",
      fullScopeHelp: "Artwork continues behind the live sidebar, which uses the selected translucent overlay.",
      artworkLayers: "Images",
      layersHelp: "Add up to eight pointer-inert images. Each layer can target an appearance, page context, and window size.",
      addLayer: "Add layer",
      addArtwork: "Add image…",
      artworkRoleChoice: "Image type",
      artworkVisibilityHelp: "Show in theme changes Aura. Hide in the preview is temporary.",
      layerPlacementShared: "This image shares one position across {0}. Open Advanced to limit its appearance or page, or add a separate image.",
      layerPlacementSpecific: "This position changes only {0}.",
      appearanceBoth: "Light and Dark",
      contextBoth: "New chat and Conversation",
      promptPlacement: "New chat area",
      promptPlacementHelp: "Drag it in the preview or use these controls. Light and Dark share this position; Conversation composers never move.",
      nativePromptHelp: "Using Claude's current layout. Your first adjustment adopts the measured live size and position.",
      conversationLayout: "Conversation layout",
      conversationLayoutHelp: "Conversation uses Claude's live composer position. Choose New chat above to edit the movable new-chat area.",
      promptWidth: "Width",
      horizontalOffset: "Horizontal offset",
      verticalOffset: "Vertical offset",
      assetGuide: "Asset and safe-zone guide",
      guideOnlyNotice: "Guide only — this is not a Claude preview. Review the saved theme in the actual Aura window.",
      sidebarZone: "Sidebar zone",
      textSafeZone: "Text-safe zone",
      edgeCropZone: "Edge crop",
      composerReserve: "Composer reserve",
      assetGuideCaption: "Keep detailed subjects outside the text-safe and composer zones. The exact live layout can change.",
      promptBuilder: "Local artwork prompt builder",
      promptBuilderHelp: "Build a slot-specific prompt locally. Nothing is sent to a model or network service.",
      assetSlot: "Asset slot",
      artworkSubject: "Subject or motif",
      artworkDirection: "Visual direction",
      buildPrompt: "Build prompt",
      copyPrompt: "Copy prompt",
      generatedPrompt: "Generated prompt",
      validationAndBudgets: "Validation and budgets",
      cancelEditing: "Cancel",
      saveTheme: "Save theme",
      keepEditing: "Keep editing",
      duplicateToCustomize: "Duplicate to customize",
      editTheme: "Edit",
      deleteTheme: "Delete",
      builtInTheme: "Built-in",
      customTheme: "Custom",
      editorTitleFor: "Edit {0}",
      editorSummary: "Valid draft changes apply to Aura and Studio immediately.",
      savedState: "Saved",
      unsavedState: "Unsaved changes",
      validState: "Preview up to date",
      invalidState: "Preview uses the last valid settings",
      editorReady: "Theme editor ready.",
      editorBusy: "Applying editor change…",
      editorStateRejected: "The editor received invalid state. Close Studio and try again.",
      editorActionFailed: "The change was not applied. Review the highlighted setting and try again.",
      launcherMarkImported: "App mark replaced.",
      launcherMarkFailed: "The app mark could not be replaced. Choose a static, transparent 96 × 96 PNG smaller than 400 KB.",
      launcherMarkApplyFailed: "The app mark is in your draft, but Windows could not update it everywhere. Try again or restart Aura.",
      saveBlocked: "Fix the validation issues before saving.",
      copiedModes: "Appearance colors copied.",
      copiedPrompt: "Prompt copied.",
      copyPromptFailed: "The prompt could not be copied. Select the text and copy it manually.",
      promptBuilt: "Prompt built locally.",
      layerLimit: "A theme can contain up to eight images.",
      noLayers: "No images yet. Add one when the theme needs it.",
      layerNumber: "Image {0}",
      layerName: "{0} {1}",
      layerSummary: "{0} · {1} · {2}",
      replaceImage: "Replace",
      moveUp: "Send backward",
      moveDown: "Bring forward",
      removeLayer: "Remove from theme",
      layerRole: "Image type",
      roleBackground: "Background",
      roleHero: "Main subject",
      roleCorner: "Corner graphic",
      roleDecoration: "Decoration",
      appearanceUse: "Theme mode",
      appearanceAll: "Both modes",
      appearanceLight: "Light only",
      appearanceDark: "Dark only",
      contextUse: "Page",
      previewPage: "Preview page",
      contextAll: "All pages",
      contextNewChat: "New chat only",
      contextConversation: "Conversation only",
      viewportUse: "Window size",
      viewportAll: "All sizes",
      viewportNormal: "Standard only",
      viewportWide: "Wide only",
      layerVisible: "Show in theme",
      layerInspectorTitle: "Selected image",
      exactValue: "Exact value",
      layerOpacity: "Opacity",
      layerMask: "Edge fade",
      maskNone: "None",
      maskSoftRight: "Fade right edge",
      mobileBehavior: "Small windows",
      mobileKeep: "Keep size",
      mobileReduce: "Reduce",
      mobileHide: "Hide",
      normalPreset: "Position for: Standard",
      widePreset: "Position for: Wide",
      anchor: "Pin to",
      anchorTopLeft: "Top left",
      anchorTop: "Top",
      anchorTopRight: "Top right",
      anchorLeft: "Left",
      anchorCenter: "Center",
      anchorRight: "Right",
      anchorBottomLeft: "Bottom left",
      anchorBottom: "Bottom",
      anchorBottomRight: "Bottom right",
      focalX: "Image focus: horizontal",
      focalY: "Image focus: vertical",
      positionX: "Horizontal offset",
      positionY: "Vertical offset",
      scale: "Size",
      imageBytes: "{0} of 400 KB",
      noImagePreview: "Image",
      groupCanvas: "Page background",
      groupSidebar: "Sidebar",
      groupSurface: "Panels",
      groupText: "Text",
      groupAccent: "Accent",
      groupBorder: "Borders",
      canvasColor: "Page background",
      sidebarColor: "Sidebar",
      surfaceColor: "Panels",
      textColor: "Text",
      accentColor: "Accent",
      borderColor: "Borders",
      surfaceAlpha: "Panel opacity",
      sidebarAlpha: "Sidebar opacity",
      fontSystemSans: "System sans",
      fontHumanistSans: "Humanist sans",
      fontRoundedSans: "Rounded sans",
      fontEditorialSerif: "Editorial serif",
      shadowNone: "None",
      shadowSoft: "Soft",
      shadowElevated: "Strong",
      confirmResetTitle: "Reset all draft changes?",
      confirmResetBody: "This discards every change from the current edit session and restores the saved theme. The reset cannot be undone.",
      confirmResetAction: "Reset changes",
      confirmDiscardTitle: "Discard unsaved changes?",
      confirmDiscardBody: "Unsaved theme changes will be removed. The saved theme and its artwork stay unchanged.",
      confirmDiscardAction: "Discard changes",
      confirmDeleteTitle: "Delete {0}?",
      confirmDeleteBody: "This permanently deletes the custom theme and cannot be undone. If it is active, Aura applies Default first. Built-in themes are not affected.",
      confirmDeleteAction: "Delete theme",
      feedbackValid: "All checks pass",
      feedbackInvalid: "Some checks need attention",
      quickFeedbackValid: "Ready to save · contrast and size checks pass.",
      quickFeedbackInvalid: "Needs attention · {0}",
      studioLastValid: "Studio is showing the last valid colors until this issue is fixed.",
      quickFeedbackFix: "Open the highlighted setting and adjust it before saving.",
      validationColorFix: "A color combination does not have enough contrast. Adjust the highlighted color.",
      validationBudgetFix: "Theme artwork is over its size limit. Replace or remove the highlighted image.",
      validationArtworkFix: "An artwork setting needs attention. Open the highlighted layer and adjust it.",
      validationMetadataFix: "A theme name or description needs attention. Complete the highlighted field.",
      validationIdentityFix: "Adjust the App identity colors so the label remains readable.",
      validationGenericFix: "One setting needs attention. Open the highlighted control and adjust it.",
      contrastCheck: "{0} contrast",
      contrastCanvasText: "Canvas and text",
      contrastSurfaceText: "Surface and text",
      contrastMutedText: "Secondary text",
      contrastAccentOutline: "Accent and outline",
      contrastAccentText: "Accent and text",
      contrastSidebarText: "Sidebar and text",
      contrastFocus: "Focus indicator",
      budgetChrome: "Theme payload",
      budgetArtwork: "Embedded artwork",
      budgetSourceArtwork: "Source artwork",
      budgetLayer: "Artwork layer",
      budgetValue: "{0} / {1}",
      checkPass: "Pass",
      checkFail: "Needs attention",
      validationIssue: "Review {0} and adjust the highlighted setting.",
      firstIssue: "Go to first issue",
      slotBackground: "Background",
      slotHero: "Hero",
      slotCornerTopRight: "Top-right corner",
      slotCornerBottom: "Bottom corner",
      slotCard1: "Card 1",
      slotCard2: "Card 2",
      slotCard3: "Card 3",
      slotBrandMark: "Brand mark",
      slotLauncherMark: "App + launcher mark",
      stageTitle: "Live preview",
      stageEvidence: "Placement aid · not a Claude preview or acceptance evidence",
      stageNotice: "When available, the canvas uses a private capture of the actual Aura window with editable Aura artwork over it. Otherwise it shows the placement guide. It is not a Claude preview or acceptance evidence.",
      stageSize: "Preview size",
      stageNormal: "Standard",
      stageWide: "Wide",
      stageRealLabel: "Aura window",
      stageRealLaunch: "Launch size",
      stageRealWide: "Wide (≥1440)",
      stageRealFull: "Maximized",
      stageRealHelp: "Every valid draft already applies to the actual Aura window on live claude.ai. Preview-size changes leave Studio in front; use Review in Aura only when you want to interact with the separate live window.",
      stageRealShown: "Aura preview size updated. Studio remains in front.",
      stageTopmost: "Keep on top",
      topmostOn: "The Aura window now stays on top.",
      topmostOff: "The Aura window no longer stays on top.",
      customWidth: "Width",
      customHeight: "Height",
      sizeUpdatesLive: "px · updates live",
      mirrorTitle: "Live capture",
      mirrorPrivacy: "May show conversation content. The capture stays in this device's memory and is never saved.",
      mirrorEmpty: "Waiting for the actual Aura window.",
      mirrorRefresh: "Refresh",
      mirrorCaption: "Live Aura · {2} · {0}×{1}",
      mirrorCaptionCached: "Captured {2} · {0}×{1}",
      mirrorUnavailable: "No {0} capture yet.",
      mirrorAlt: "Scaled capture of the actual Aura window",
      openAuraWindow: "Review in Aura ↗",
      previewSizeHelp: "Dimensions update automatically. Standard is used below 1440 px; Wide is used from 1440 px.",
      stageBackdropToggle: "Drag on the live capture",
      stageBackdropReady: "Live capture enabled — the stage now overlays the real window, and artwork appears while you drag it.",
      stageLayersPanel: "Images",
      stageContextMismatch: "Open {0} in Aura once to capture this preview. Studio keeps it in memory only for this editing session.",
      stageOpenContext: "Switch in Aura…",
      stageContextSelected: "{0} preview selected.",
      stageEyeToggle: "Show image {0} ({1}) in preview",
      stageEyeHide: "Hide on editing stage only",
      stageEyeShow: "Show on editing stage",
      stageEyeHideShort: "Hide",
      stageEyeShowShort: "Show",
      stageSelectLayer: "Edit layer {0}",
      stageMoveHandle: "Move",
      editorLevel: "Editing mode",
      levelSimple: "Quick customize",
      levelAdvanced: "Advanced",
      inspectorTitle: "Edit theme",
      inspectorSections: "Theme editor branches",
      branchInterface: "Interface",
      branchBackground: "Background",
      branchWidgets: "Widgets",
      branchInterfaceDetail: "Surfaces & layout",
      branchBackgroundDetail: "Canvas & images",
      branchWidgetsDetail: "Aura controls",
      branchInterfaceHelp: "Interface tool: select interface regions; images stay click-through.",
      branchBackgroundHelp: "Background tool: select the theme canvas or images; interface regions stay click-through.",
      branchWidgetsHelp: "Widgets tool: select Aura-owned controls in their local previews.",
      targetPicker: "Target",
      editingContext: "Editing",
      appliesToContext: "Applies to",
      sourceContext: "Source",
      editTargetContext: "Edit target",
      documentDetails: "Document details",
      targetInterfaceTheme: "Overall interface",
      targetNewChatArea: "New chat area",
      targetBackgroundCanvas: "Theme canvas",
      targetBackgroundLayer: "Images",
      targetAppIdentity: "App identity",
      themeOriginalSource: "Theme original",
      customizedSource: "Customized",
      allModesScope: "Light and Dark",
      allPagesScope: "All pages",
      frameStandard: "Standard",
      frameWide: "Wide",
      customFrameUses: "Custom preview uses {0}",
      switchPreview: "Switch preview",
      advancedValuesNotice: "This target has additional values in Advanced.",
      reviewStates: "Review states",
      matrixTitle: "Every state at a glance",
      matrixHint: "Select a state to edit it.",
      hiddenInStageView: "Not in this preview · {0}",
      copyFramingToWide: "Copy placement to Wide",
      copyFramingToNormal: "Copy placement to Standard",
      framingCopied: "Framing copied to {0}.",
      stageNewChat: "New chat",
      stageConversation: "Conversation",
      stageShowZones: "Show safe zones",
      stageKeyboardHelp: "Select an image or the new chat area in the preview. Drag to move; drag a handle to resize. Arrow keys make precise adjustments.",
      stagePromptTag: "New chat area",
      stageLayerAria: "Image {0} ({1}). Arrow keys move it; plus and minus resize.",
      stagePromptAria: "New chat area. Arrow keys move it; bracket keys adjust width.",
      stageEmpty: "No images are used in this preview.",
      stageSelectedAnnounce: "{0} selected.",
      stageScaleHandle: "Resize image",
      stageWidthHandle: "Resize new chat area",
      promptTemplate: "Create a {0} theme artwork asset. Subject: {1}. Visual direction: {2}. {3} Decorative artwork only; no interface text, controls, borrowed logos, remote resources, or photographic people. Keep the composition usable when clipped at different window sizes.",
      launcherPromptTemplate: "Create a production-ready {0}. Subject: {1}. Visual direction: {2}. {3} Output one square transparent PNG at exactly 96×96 px. Keep the silhouette legible at 24–48 px and centered inside a 72×72 px safe area. Use no words, interface controls, borrowed logos, remote resources, photographic people, opaque background, border, or baked drop shadow.",
      promptFallbackSubject: "an original abstract motif",
      promptFallbackStyle: "quiet, polished, and legible behind interface content",
      promptRuleBackground: "Use a wide opaque scene with low detail through the central text-safe area.",
      promptRuleHero: "Keep the main subject inside the right 60% with clean transparent or soft-matte edges.",
      promptRuleCorner: "Use a transparent composition that remains intentional when clipped at the viewport edge.",
      promptRuleCard: "Use a square transparent composition with the subject concentrated in the bottom-right 40%.",
      promptRuleBrand: "Use a small, flat, original mark with no words or borrowed brand shapes.",
      promptRuleLauncher: "Design one original compact mark that represents the theme across the floating launcher, title bar, taskbar, tray, Studio, and the Aura and Aura Studio shortcuts on Desktop and in the Start menu.",
    },
    "zh-CN": {
      navEditor: "主题编辑器",
      editorKicker: "无代码主题编辑",
      historyActions: "编辑历史",
      undo: "撤销",
      redo: "重做",
      resetChanges: "重置",
      backToThemes: "返回主题",
      themeIdentity: "主题名称",
      themeIdentityHelp: "请填写需要支持的各界面语言下显示的主题名称。",
      themeNameEn: "英文名称",
      themeNameZhCn: "简体中文名称",
      themeNameZhTw: "繁体中文（台湾）名称",
      themeDescriptionEn: "英文说明",
      themeDescriptionZhCn: "简体中文说明",
      themeDescriptionZhTw: "繁体中文（台湾）说明",
      editAppearance: "主题模式",
      lightMode: "浅色",
      darkMode: "深色",
      copyLightToDark: "将浅色配色复制到深色",
      copyDarkToLight: "将深色配色复制到浅色",
      modeHelp: "浅色和深色可使用不同的配色和图片。",
      colorsAndSurfaces: "颜色",
      colorsHelp: "在“快速自定义”中选择主要颜色；“高级”还可调整辅助颜色和精确值。",
      typographyAndMaterials: "字体与效果",
      studioStyleHelp: "这些字体、圆角、模糊和阴影设置会同时应用到 Aura 和 Studio。",
      appIdentity: "应用标识",
      appIdentityHelp: "更换 Aura、Studio、启动器、任务栏和系统托盘使用的标识图，或调整周边控件的样式。请选择小于 400 KB、96 × 96 px 的静态透明 PNG。",
      appIdentityPreview: "应用标识预览",
      selectAppIdentityPreview: "选择应用标识",
      replaceAppMark: "更换标识图",
      launcherSurface: "标识背景",
      launcherSurfaceHover: "悬停背景",
      launcherForeground: "标签和拖动柄",
      launcherAccent: "标识强调色",
      launcherBorder: "标识边框",
      launcherRadius: "标识圆角",
      launcherBorderWidth: "边框宽度",
      interfaceFont: "界面字体",
      displayFont: "标题字体",
      cornerRadius: "圆角",
      themeOriginal: "主题原有设置",
      inheritedRadiusHelp: "主题原有设置。调整后，所有界面元素将共用同一圆角半径。",
      surfaceBlur: "面板模糊",
      softShadow: "阴影",
      themeBackground: "主题背景",
      backgroundScope: "背景范围",
      contentCanvas: "仅主区域",
      fullWindow: "整个窗口",
      contentScopeHelp: "背景从实际侧边栏之后开始显示。",
      fullScopeHelp: "背景延伸至实际侧边栏后方，侧边栏使用所选的半透明覆盖层。",
      artworkLayers: "图片",
      layersHelp: "最多添加八个不响应指针操作的图片图层，并分别设置外观、页面场景及窗口尺寸。",
      addLayer: "添加图层",
      addArtwork: "添加图片…",
      artworkRoleChoice: "图片类型",
      artworkVisibilityHelp: "“在主题中显示”会应用到 Aura；预览中的“隐藏”只影响本次编辑。",
      layerPlacementShared: "此图片在{0}中共用一个位置。请打开“高级”，限制适用外观或页面；也可添加单独的图片。",
      layerPlacementSpecific: "此位置仅会更改{0}。",
      appearanceBoth: "浅色和深色",
      contextBoth: "新对话和对话",
      promptPlacement: "新对话区域",
      promptPlacementHelp: "可在预览中拖动，也可使用下方控件。浅色和深色共用此位置；对话中的输入框不会移动。",
      nativePromptHelp: "正在沿用 Claude 当前布局。首次调整时，会先采用实时测得的大小和位置。",
      conversationLayout: "对话布局",
      conversationLayoutHelp: "对话使用 Claude 的实时输入框位置。请在上方选择“新对话”，再调整可移动的新对话区域。",
      promptWidth: "宽度",
      horizontalOffset: "水平偏移",
      verticalOffset: "垂直偏移",
      assetGuide: "素材与安全区域指南",
      guideOnlyNotice: "仅作素材位置参考，这不是 Claude 预览。请在实际 Aura 窗口中检查保存后的主题。",
      sidebarZone: "侧边栏区域",
      textSafeZone: "文字安全区域",
      edgeCropZone: "边缘裁切区域",
      composerReserve: "输入框预留区域",
      assetGuideCaption: "请勿在文字安全区域和输入框预留区域放置复杂主体。实际页面布局可能变化。",
      promptBuilder: "本地图片提示词生成器",
      promptBuilderHelp: "在本地生成适用于指定素材槽位的提示词，不会向模型或网络服务发送内容。",
      assetSlot: "素材槽位",
      artworkSubject: "主体或图案",
      artworkDirection: "视觉方向",
      buildPrompt: "生成提示词",
      copyPrompt: "复制提示词",
      generatedPrompt: "生成的提示词",
      validationAndBudgets: "校验与容量限制",
      cancelEditing: "取消",
      saveTheme: "保存主题",
      keepEditing: "继续编辑",
      duplicateToCustomize: "复制并自定义",
      editTheme: "编辑",
      deleteTheme: "删除",
      builtInTheme: "内置",
      customTheme: "自定义",
      editorTitleFor: "编辑{0}",
      editorSummary: "有效的草稿更改会立即应用到 Aura 和 Studio。",
      savedState: "已保存",
      unsavedState: "有未保存的更改",
      validState: "预览已更新",
      invalidState: "预览仍显示上一次有效设置",
      editorReady: "主题编辑器已就绪。",
      editorBusy: "正在应用编辑内容…",
      editorStateRejected: "编辑器收到的状态无效。请关闭工作室后重试。",
      editorActionFailed: "更改未应用。请检查标记的设置后重试。",
      launcherMarkImported: "应用标识图已更换。",
      launcherMarkFailed: "无法更换应用标识图。请选择小于 400 KB、96 × 96 px 的静态透明 PNG。",
      launcherMarkApplyFailed: "应用标识图已加入草稿，但 Windows 未能在所有位置完成更新。请重试或重新启动 Aura。",
      saveBlocked: "请先修正校验问题再保存。",
      copiedModes: "外观配色已复制。",
      copiedPrompt: "提示词已复制。",
      copyPromptFailed: "无法复制提示词。请选中文本后手动复制。",
      promptBuilt: "提示词已在本地生成。",
      layerLimit: "一个主题最多可包含八张图片。",
      noLayers: "还没有图片。需要时可添加一张。",
      layerNumber: "图片 {0}",
      layerName: "{0} {1}",
      layerSummary: "{0} · {1} · {2}",
      replaceImage: "替换",
      moveUp: "下移一层",
      moveDown: "上移一层",
      removeLayer: "从主题中移除",
      layerRole: "图片类型",
      roleBackground: "背景",
      roleHero: "主体",
      roleCorner: "角落装饰",
      roleDecoration: "装饰",
      appearanceUse: "主题模式",
      appearanceAll: "浅色和深色",
      appearanceLight: "仅浅色",
      appearanceDark: "仅深色",
      contextUse: "页面",
      previewPage: "预览页面",
      contextAll: "所有页面",
      contextNewChat: "仅新对话",
      contextConversation: "仅对话页面",
      viewportUse: "窗口尺寸",
      viewportAll: "所有尺寸",
      viewportNormal: "仅标准窗口",
      viewportWide: "仅宽屏",
      layerVisible: "在主题中显示",
      layerInspectorTitle: "所选图片",
      exactValue: "精确值",
      layerOpacity: "不透明度",
      layerMask: "边缘渐隐",
      maskNone: "无",
      maskSoftRight: "淡出右边缘",
      mobileBehavior: "小窗口",
      mobileKeep: "保持大小",
      mobileReduce: "缩小",
      mobileHide: "隐藏",
      normalPreset: "位置：标准",
      widePreset: "位置：宽屏",
      anchor: "定位基准",
      anchorTopLeft: "左上",
      anchorTop: "上方",
      anchorTopRight: "右上",
      anchorLeft: "左侧",
      anchorCenter: "居中",
      anchorRight: "右侧",
      anchorBottomLeft: "左下",
      anchorBottom: "下方",
      anchorBottomRight: "右下",
      focalX: "图像焦点：水平",
      focalY: "图像焦点：垂直",
      positionX: "水平偏移",
      positionY: "垂直偏移",
      scale: "大小",
      imageBytes: "{0} / 400 KB",
      noImagePreview: "图片",
      groupCanvas: "页面背景",
      groupSidebar: "侧边栏",
      groupSurface: "面板",
      groupText: "文字",
      groupAccent: "强调色",
      groupBorder: "边框",
      canvasColor: "页面背景",
      sidebarColor: "侧边栏",
      surfaceColor: "面板",
      textColor: "文字",
      accentColor: "强调色",
      borderColor: "边框",
      surfaceAlpha: "面板不透明度",
      sidebarAlpha: "侧边栏不透明度",
      fontSystemSans: "系统无衬线字体",
      fontHumanistSans: "人文无衬线字体",
      fontRoundedSans: "圆体无衬线字体",
      fontEditorialSerif: "编辑风衬线字体",
      shadowNone: "无",
      shadowSoft: "柔和",
      shadowElevated: "明显",
      confirmResetTitle: "确认重置全部草稿更改？",
      confirmResetBody: "此操作将放弃本次编辑中的全部更改，并恢复已保存的主题。重置后无法撤销。",
      confirmResetAction: "重置更改",
      confirmDiscardTitle: "确认放弃未保存的更改？",
      confirmDiscardBody: "未保存的主题更改将被移除，已保存的主题及其图片不受影响。",
      confirmDiscardAction: "放弃更改",
      confirmDeleteTitle: "确认删除{0}？",
      confirmDeleteBody: "此操作将永久删除该自定义主题，且无法恢复。如果当前正在使用该主题，Aura 会先应用默认主题。内置主题不受影响。",
      confirmDeleteAction: "删除主题",
      feedbackValid: "全部校验已通过",
      feedbackInvalid: "部分项目需要处理",
      quickFeedbackValid: "可以保存 · 对比度和容量校验均已通过。",
      quickFeedbackInvalid: "需要调整 · {0}",
      studioLastValid: "在问题修正前，Studio 将继续显示上一个有效配色。",
      quickFeedbackFix: "请打开已标记的设置并完成调整，然后再保存。",
      validationColorFix: "部分颜色组合的对比度不足，请调整已标记的颜色。",
      validationBudgetFix: "主题美术素材超出容量限制，请替换或移除已标记的图片。",
      validationArtworkFix: "美术素材设置需要调整，请打开已标记的图层并修改。",
      validationMetadataFix: "主题名称或说明需要调整，请填写已标记的字段。",
      validationIdentityFix: "调整应用标识颜色，确保标签清晰可读。",
      validationGenericFix: "有一项设置需要调整，请打开已标记的控件并修改。",
      contrastCheck: "{0}对比度",
      contrastCanvasText: "画布与文字",
      contrastSurfaceText: "表面与文字",
      contrastMutedText: "次要文字",
      contrastAccentOutline: "强调色与轮廓",
      contrastAccentText: "强调色与文字",
      contrastSidebarText: "侧边栏与文字",
      contrastFocus: "焦点指示",
      budgetChrome: "主题载荷",
      budgetArtwork: "嵌入图片",
      budgetSourceArtwork: "源图片",
      budgetLayer: "图片图层",
      budgetValue: "{0} / {1}",
      checkPass: "通过",
      checkFail: "需要处理",
      validationIssue: "请检查{0}并调整已标记的设置。",
      firstIssue: "转到第一个问题",
      slotBackground: "背景",
      slotHero: "主视觉",
      slotCornerTopRight: "右上角",
      slotCornerBottom: "底部角落",
      slotCard1: "卡片 1",
      slotCard2: "卡片 2",
      slotCard3: "卡片 3",
      slotBrandMark: "品牌标记",
      slotLauncherMark: "应用与启动器标记",
      stageTitle: "实时预览",
      stageEvidence: "构图辅助 · 不是 Claude 预览或验收证据",
      stageNotice: "有可用画面时，画布会显示实际 Aura 窗口的本机截取画面，并叠加可编辑的 Aura 图片。没有匹配画面时会显示构图示意图；此画布不是 Claude 预览或验收证据。",
      stageSize: "预览尺寸",
      stageNormal: "标准",
      stageWide: "宽屏",
      stageRealLabel: "Aura 窗口",
      stageRealLaunch: "启动尺寸",
      stageRealWide: "宽屏（≥1440）",
      stageRealFull: "最大化",
      stageRealHelp: "每次通过校验的草稿更改都会立即应用到实际的 Aura 窗口（真实 claude.ai 页面）。调整预览尺寸时，Studio 会保持在前台；仅在需要操作独立窗口时使用“在 Aura 中检查”。",
      stageRealShown: "Aura 预览尺寸已更新，Studio 会保持在前台。",
      stageTopmost: "保持置顶",
      topmostOn: "Aura 窗口已保持置顶。",
      topmostOff: "Aura 窗口已取消置顶。",
      customWidth: "宽度",
      customHeight: "高度",
      sizeUpdatesLive: "px · 即时更新",
      mirrorTitle: "实时截取画面",
      mirrorPrivacy: "画布可能包含对话内容。截取画面只保留在本机内存中，绝不会保存。",
      mirrorEmpty: "正在等待实际 Aura 窗口。",
      mirrorRefresh: "刷新",
      mirrorCaption: "Aura 实时画面 · {2} · {0}×{1}",
      mirrorCaptionCached: "已捕获的{2}画面 · {0}×{1}",
      mirrorUnavailable: "尚未捕获{0}画面。",
      mirrorAlt: "实际 Aura 窗口的缩放画面",
      openAuraWindow: "在 Aura 中检查 ↗",
      previewSizeHelp: "尺寸会自动更新。宽度低于 1440 px 时使用“标准”，达到 1440 px 时使用“宽屏”。",
      stageBackdropToggle: "在实时画面上拖动",
      stageBackdropReady: "已启用实时画面背景：画布现在叠加在实际窗口画面上，拖动图片时会显示半透明预览。",
      stageLayersPanel: "图片",
      stageContextMismatch: "请在 Aura 中打开一次{0}，以捕获该预览。Studio 仅在本次编辑期间将画面保留在内存中。",
      stageOpenContext: "在 Aura 中切换…",
      stageContextSelected: "已选择{0}预览。",
      stageEyeToggle: "在预览中显示图片 {0}（{1}）",
      stageEyeHide: "仅在编辑画布中隐藏",
      stageEyeShow: "在编辑画布中显示",
      stageEyeHideShort: "隐藏",
      stageEyeShowShort: "显示",
      stageSelectLayer: "编辑图层 {0}",
      stageMoveHandle: "移动",
      editorLevel: "编辑模式",
      levelSimple: "快速自定义",
      levelAdvanced: "高级",
      inspectorTitle: "编辑主题",
      inspectorSections: "主题编辑分区",
      branchInterface: "界面",
      branchBackground: "背景",
      branchWidgets: "小组件",
      branchInterfaceDetail: "外观与布局",
      branchBackgroundDetail: "画布与图片",
      branchWidgetsDetail: "Aura 控件",
      branchInterfaceHelp: "界面工具：选择界面区域；图片不会拦截点击。",
      branchBackgroundHelp: "背景工具：选择主题画布或图片；界面区域不会拦截点击。",
      branchWidgetsHelp: "小组件工具：在专用预览中选择 Aura 控件。",
      targetPicker: "编辑对象",
      editingContext: "正在编辑",
      appliesToContext: "作用范围",
      sourceContext: "来源",
      editTargetContext: "编辑尺寸",
      documentDetails: "文档信息",
      targetInterfaceTheme: "整体界面",
      targetNewChatArea: "新对话区域",
      targetBackgroundCanvas: "主题画布",
      targetBackgroundLayer: "图片",
      targetAppIdentity: "应用标识",
      themeOriginalSource: "主题原始设置",
      customizedSource: "已自定义",
      allModesScope: "浅色和深色",
      allPagesScope: "所有页面",
      frameStandard: "标准",
      frameWide: "宽屏",
      customFrameUses: "自定义预览使用“{0}”设置",
      switchPreview: "切换预览",
      advancedValuesNotice: "此对象在“高级”模式中还有更多设置。",
      reviewStates: "检查不同状态",
      matrixTitle: "全部状态一览",
      matrixHint: "点击某个状态即可编辑。",
      hiddenInStageView: "不在当前预览中显示 · {0}",
      copyFramingToWide: "将位置设置复制到“宽屏”",
      copyFramingToNormal: "将位置设置复制到“标准”",
      framingCopied: "构图已复制到{0}。",
      stageNewChat: "新对话",
      stageConversation: "对话",
      stageShowZones: "显示安全区域",
      stageKeyboardHelp: "在预览中选中图片或新对话区域。拖动可移动，拖动控制点可调整大小；方向键可精确微调。",
      stagePromptTag: "新对话区域",
      stageLayerAria: "图片 {0}（{1}）。使用方向键移动，加号和减号调整大小。",
      stagePromptAria: "新对话区域。使用方向键移动，中括号键调整宽度。",
      stageEmpty: "此预览未使用任何图片。",
      stageSelectedAnnounce: "已选中{0}。",
      stageScaleHandle: "缩放图片",
      stageWidthHandle: "调整新对话区域大小",
      promptTemplate: "创建一个{0}主题图片素材。主体：{1}。视觉方向：{2}。{3} 图片仅用于装饰；不得包含界面文字、控件、他人品牌标识、远程资源或真实人物照片。请确保构图在不同窗口尺寸下裁切后仍可使用。",
      launcherPromptTemplate: "创建一个可直接使用的{0}。主体：{1}。视觉方向：{2}。{3} 输出一张 96×96 px 的正方形透明 PNG。图形需在 24–48 px 下清晰可辨，并位于中央 72×72 px 的安全区域内。不得包含文字、界面控件、他人品牌标识、远程资源、真实人物照片、不透明背景、外框或图片自带阴影。",
      promptFallbackSubject: "原创抽象图案",
      promptFallbackStyle: "安静、精致，并确保界面内容清晰可读",
      promptRuleBackground: "使用宽幅不透明场景，中央文字安全区域保持低细节。",
      promptRuleHero: "将主要主体放在右侧 60% 范围内，并使用干净的透明边缘或柔和衬底。",
      promptRuleCorner: "使用透明构图，确保在视口边缘裁切后仍然完整自然。",
      promptRuleCard: "使用方形透明构图，主体集中在右下方 40% 范围内。",
      promptRuleBrand: "使用不含文字及他人品牌造型的小型原创平面标记。",
      promptRuleLauncher: "设计一个能代表主题的原创紧凑标记，用于悬浮启动器、标题栏、任务栏、系统托盘、Studio，以及桌面和开始菜单中的 Aura 与 Aura Studio 快捷方式。",
    },
    "zh-TW": {
      navEditor: "主題編輯器",
      editorKicker: "不用寫程式也能編輯主題",
      historyActions: "編輯記錄",
      undo: "復原",
      redo: "重做",
      resetChanges: "重設",
      backToThemes: "回到主題",
      themeIdentity: "主題名稱",
      themeIdentityHelp: "填寫需要支援的各介面語言名稱。",
      themeNameEn: "英文名稱",
      themeNameZhCn: "簡體中文名稱",
      themeNameZhTw: "繁體中文（台灣）名稱",
      themeDescriptionEn: "英文說明",
      themeDescriptionZhCn: "簡體中文說明",
      themeDescriptionZhTw: "繁體中文（台灣）說明",
      editAppearance: "主題模式",
      lightMode: "淺色",
      darkMode: "深色",
      copyLightToDark: "將淺色配色複製到深色",
      copyDarkToLight: "將深色配色複製到淺色",
      modeHelp: "淺色與深色可使用不同的配色和圖片。",
      colorsAndSurfaces: "顏色",
      colorsHelp: "在「快速自訂」選擇主要顏色；「進階」還能調整輔助顏色與精確數值。",
      typographyAndMaterials: "字體與效果",
      studioStyleHelp: "這些字體、圓角、模糊與陰影設定會同時套用到 Aura 和 Studio。",
      appIdentity: "App 識別",
      appIdentityHelp: "更換 Aura、Studio、啟動器、工作列與系統匣使用的識別圖，或調整周邊控制項的樣式。請選擇小於 400 KB、96 × 96 px 的靜態透明 PNG。",
      appIdentityPreview: "App 識別預覽",
      selectAppIdentityPreview: "選取 App 識別",
      replaceAppMark: "更換識別圖",
      launcherSurface: "識別背景",
      launcherSurfaceHover: "游標移入背景",
      launcherForeground: "標籤與拖曳把手",
      launcherAccent: "識別強調色",
      launcherBorder: "識別邊框",
      launcherRadius: "識別圓角",
      launcherBorderWidth: "邊框寬度",
      interfaceFont: "介面字體",
      displayFont: "標題字體",
      cornerRadius: "圓角",
      themeOriginal: "沿用主題設定",
      inheritedRadiusHelp: "沿用主題設定。調整後，所有介面元素會共用同一個圓角大小。",
      surfaceBlur: "面板模糊",
      softShadow: "陰影",
      themeBackground: "主題背景",
      backgroundScope: "背景範圍",
      contentCanvas: "只顯示在主要區域",
      fullWindow: "整個視窗",
      contentScopeHelp: "背景會從實際側邊欄後方開始顯示。",
      fullScopeHelp: "背景會延伸到實際側邊欄後方，側邊欄則套用所選的半透明覆蓋層。",
      artworkLayers: "圖片",
      layersHelp: "最多可新增八個不會接收指標操作的圖片圖層，並分別設定外觀、頁面情境和視窗大小。",
      addLayer: "新增圖層",
      addArtwork: "加入圖片…",
      artworkRoleChoice: "圖片類型",
      artworkVisibilityHelp: "「顯示在主題中」會套用到 Aura；預覽裡的「隱藏」只影響這次編輯。",
      layerPlacementShared: "這張圖片會在{0}共用同一個位置。請開啟「進階」，限制套用的外觀或頁面；也可以另外加入一張圖片。",
      layerPlacementSpecific: "這個位置只會變更{0}。",
      appearanceBoth: "淺色與深色",
      contextBoth: "新對話與對話",
      promptPlacement: "新對話區域",
      promptPlacementHelp: "可在預覽中拖曳，也可使用下方控制項。淺色與深色共用這個位置；對話中的輸入框不會移動。",
      nativePromptHelp: "目前沿用 Claude 的版面。首次調整時，會先套用即時偵測到的大小與位置。",
      conversationLayout: "對話版面",
      conversationLayoutHelp: "對話會沿用 Claude 目前的輸入框位置。請先在上方選擇「新對話」，再調整可移動的新對話區域。",
      promptWidth: "寬度",
      horizontalOffset: "水平位移",
      verticalOffset: "垂直位移",
      assetGuide: "素材與安全區域指南",
      guideOnlyNotice: "這只是素材位置指南，不是 Claude 預覽。請到實際的 Aura 視窗檢查儲存後的主題。",
      sidebarZone: "側邊欄區域",
      textSafeZone: "文字安全區域",
      edgeCropZone: "邊緣裁切區域",
      composerReserve: "輸入框預留區域",
      assetGuideCaption: "請避免在文字安全區域和輸入框預留區域放置複雜主體。實際頁面配置可能改變。",
      promptBuilder: "本機圖片提示詞產生器",
      promptBuilderHelp: "在本機產生適合指定素材槽位的提示詞，不會將內容傳送給模型或網路服務。",
      assetSlot: "素材槽位",
      artworkSubject: "主體或圖案",
      artworkDirection: "視覺方向",
      buildPrompt: "產生提示詞",
      copyPrompt: "複製提示詞",
      generatedPrompt: "產生的提示詞",
      validationAndBudgets: "檢查與容量限制",
      cancelEditing: "取消",
      saveTheme: "儲存主題",
      keepEditing: "繼續編輯",
      duplicateToCustomize: "複製後自訂",
      editTheme: "編輯",
      deleteTheme: "刪除",
      builtInTheme: "內建",
      customTheme: "自訂",
      editorTitleFor: "編輯{0}",
      editorSummary: "有效的草稿變更會立即套用到 Aura 和 Studio。",
      savedState: "已儲存",
      unsavedState: "有尚未儲存的變更",
      validState: "預覽已更新",
      invalidState: "預覽仍顯示上一組有效設定",
      editorReady: "主題編輯器已準備好。",
      editorBusy: "正在套用編輯內容…",
      editorStateRejected: "編輯器收到的狀態無效。請關閉工作室後再試一次。",
      editorActionFailed: "變更未套用。請檢查標示的設定後再試一次。",
      launcherMarkImported: "App 識別圖已更換。",
      launcherMarkFailed: "無法更換 App 識別圖。請選擇小於 400 KB、96 × 96 px 的靜態透明 PNG。",
      launcherMarkApplyFailed: "App 識別圖已加入草稿，但 Windows 未能在所有位置完成更新。請再試一次或重新啟動 Aura。",
      saveBlocked: "請先修正檢查問題，再儲存主題。",
      copiedModes: "外觀配色已複製。",
      copiedPrompt: "提示詞已複製。",
      copyPromptFailed: "無法複製提示詞。請選取文字後手動複製。",
      promptBuilt: "提示詞已在本機產生。",
      layerLimit: "一個主題最多可包含八張圖片。",
      noLayers: "目前沒有圖片。需要時可加入一張。",
      layerNumber: "圖片 {0}",
      layerName: "{0} {1}",
      layerSummary: "{0} · {1} · {2}",
      replaceImage: "更換",
      moveUp: "下移一層",
      moveDown: "上移一層",
      removeLayer: "從主題移除",
      layerRole: "圖片類型",
      roleBackground: "背景",
      roleHero: "主體",
      roleCorner: "角落裝飾",
      roleDecoration: "裝飾",
      appearanceUse: "主題模式",
      appearanceAll: "淺色和深色",
      appearanceLight: "只用於淺色",
      appearanceDark: "只用於深色",
      contextUse: "頁面",
      previewPage: "預覽頁面",
      contextAll: "所有頁面",
      contextNewChat: "只用於新對話",
      contextConversation: "只用於對話頁面",
      viewportUse: "視窗大小",
      viewportAll: "所有大小",
      viewportNormal: "只在標準視窗",
      viewportWide: "只在寬螢幕",
      layerVisible: "顯示在主題中",
      layerInspectorTitle: "所選圖片",
      exactValue: "精確數值",
      layerOpacity: "不透明度",
      layerMask: "邊緣淡出",
      maskNone: "無",
      maskSoftRight: "淡出右側",
      mobileBehavior: "小視窗",
      mobileKeep: "保持大小",
      mobileReduce: "縮小",
      mobileHide: "隱藏",
      normalPreset: "位置：標準",
      widePreset: "位置：寬螢幕",
      anchor: "定位基準",
      anchorTopLeft: "左上",
      anchorTop: "上方",
      anchorTopRight: "右上",
      anchorLeft: "左側",
      anchorCenter: "置中",
      anchorRight: "右側",
      anchorBottomLeft: "左下",
      anchorBottom: "下方",
      anchorBottomRight: "右下",
      focalX: "圖片焦點：水平",
      focalY: "圖片焦點：垂直",
      positionX: "水平位移",
      positionY: "垂直位移",
      scale: "大小",
      imageBytes: "{0} / 400 KB",
      noImagePreview: "圖片",
      groupCanvas: "頁面背景",
      groupSidebar: "側邊欄",
      groupSurface: "面板",
      groupText: "文字",
      groupAccent: "強調色",
      groupBorder: "邊框",
      canvasColor: "頁面背景",
      sidebarColor: "側邊欄",
      surfaceColor: "面板",
      textColor: "文字",
      accentColor: "強調色",
      borderColor: "邊框",
      surfaceAlpha: "面板不透明度",
      sidebarAlpha: "側邊欄不透明度",
      fontSystemSans: "系統無襯線字體",
      fontHumanistSans: "人文無襯線字體",
      fontRoundedSans: "圓體無襯線字體",
      fontEditorialSerif: "編輯風襯線字體",
      shadowNone: "無",
      shadowSoft: "柔和",
      shadowElevated: "明顯",
      confirmResetTitle: "要重設所有草稿變更嗎？",
      confirmResetBody: "這會放棄本次編輯中的所有變更，並還原已儲存的主題。重設後無法復原。",
      confirmResetAction: "重設變更",
      confirmDiscardTitle: "要放棄尚未儲存的變更嗎？",
      confirmDiscardBody: "尚未儲存的主題變更會被移除；已儲存的主題和圖片都會保留。",
      confirmDiscardAction: "放棄變更",
      confirmDeleteTitle: "要刪除{0}嗎？",
      confirmDeleteBody: "這會永久刪除自訂主題，刪除後無法復原。如果目前正在使用這個主題，Aura 會先套用預設主題；內建主題不受影響。",
      confirmDeleteAction: "刪除主題",
      feedbackValid: "所有檢查都已通過",
      feedbackInvalid: "有些項目需要調整",
      quickFeedbackValid: "可以儲存 · 對比度和容量檢查都已通過。",
      quickFeedbackInvalid: "需要調整 · {0}",
      studioLastValid: "問題修正前，Studio 會繼續使用上一組有效配色。",
      quickFeedbackFix: "請打開標示的設定並調整，再儲存主題。",
      validationColorFix: "有一組顏色的對比度不足，請調整標示的顏色。",
      validationBudgetFix: "主題美術素材超過容量限制，請更換或移除標示的圖片。",
      validationArtworkFix: "美術素材設定需要調整，請打開標示的圖層修改。",
      validationMetadataFix: "主題名稱或說明需要調整，請填寫標示的欄位。",
      validationIdentityFix: "調整 App 識別顏色，讓標籤保持清楚易讀。",
      validationGenericFix: "有一項設定需要調整，請打開標示的控制項修改。",
      contrastCheck: "{0}對比度",
      contrastCanvasText: "畫布與文字",
      contrastSurfaceText: "表面與文字",
      contrastMutedText: "次要文字",
      contrastAccentOutline: "強調色與外框",
      contrastAccentText: "強調色與文字",
      contrastSidebarText: "側邊欄與文字",
      contrastFocus: "焦點指示",
      budgetChrome: "主題載荷",
      budgetArtwork: "嵌入圖片",
      budgetSourceArtwork: "來源圖片",
      budgetLayer: "圖片圖層",
      budgetValue: "{0} / {1}",
      checkPass: "通過",
      checkFail: "需要調整",
      validationIssue: "請檢查{0}並調整標示的設定。",
      firstIssue: "前往第一個問題",
      slotBackground: "背景",
      slotHero: "主視覺",
      slotCornerTopRight: "右上角",
      slotCornerBottom: "底部角落",
      slotCard1: "卡片 1",
      slotCard2: "卡片 2",
      slotCard3: "卡片 3",
      slotBrandMark: "品牌標記",
      slotLauncherMark: "App 與啟動器圖示",
      stageTitle: "即時預覽",
      stageEvidence: "構圖輔助 · 不是 Claude 預覽或驗收依據",
      stageNotice: "有可用畫面時，畫布會顯示實際 Aura 視窗的本機擷取畫面，並疊上可編輯的 Aura 圖片。沒有符合狀態的畫面時會顯示構圖示意圖；這不是 Claude 預覽或驗收依據。",
      stageSize: "預覽大小",
      stageNormal: "標準",
      stageWide: "寬螢幕",
      stageRealLabel: "Aura 視窗",
      stageRealLaunch: "啟動大小",
      stageRealWide: "寬螢幕（≥1440）",
      stageRealFull: "最大化",
      stageRealHelp: "每次通過檢查的草稿變更都會立刻套用到實際的 Aura 視窗（真實的 claude.ai 頁面）。調整預覽大小時，Studio 會留在最前面；只有要操作獨立視窗時，才使用「在 Aura 中檢查」。",
      stageRealShown: "Aura 預覽大小已更新，Studio 會留在最前面。",
      stageTopmost: "維持最上層",
      topmostOn: "Aura 視窗已維持在最上層。",
      topmostOff: "Aura 視窗已取消最上層。",
      customWidth: "寬度",
      customHeight: "高度",
      sizeUpdatesLive: "px · 即時更新",
      mirrorTitle: "即時擷取畫面",
      mirrorPrivacy: "畫布可能包含對話內容。擷取畫面只保留在本機記憶體中，絕不會儲存。",
      mirrorEmpty: "正在等待實際 Aura 視窗。",
      mirrorRefresh: "重新整理",
      mirrorCaption: "Aura 即時畫面 · {2} · {0}×{1}",
      mirrorCaptionCached: "已擷取的{2}畫面 · {0}×{1}",
      mirrorUnavailable: "還沒有{0}畫面。",
      mirrorAlt: "實際 Aura 視窗的縮放畫面",
      openAuraWindow: "在 Aura 中檢查 ↗",
      previewSizeHelp: "大小會自動更新。寬度低於 1440 px 時使用「標準」，達到 1440 px 時使用「寬螢幕」。",
      stageBackdropToggle: "在即時畫面上拖曳",
      stageBackdropReady: "已啟用即時畫面背景：畫布現在會疊在實際視窗畫面上，拖曳圖片時會顯示半透明預覽。",
      stageLayersPanel: "圖片",
      stageContextMismatch: "請先在 Aura 開啟一次{0}，Studio 就能擷取這個預覽。畫面只會在這次編輯期間保留在記憶體中。",
      stageOpenContext: "在 Aura 切換…",
      stageContextSelected: "已選取{0}預覽。",
      stageEyeToggle: "在預覽中顯示圖片 {0}（{1}）",
      stageEyeHide: "只在編輯畫布中隱藏",
      stageEyeShow: "在編輯畫布中顯示",
      stageEyeHideShort: "隱藏",
      stageEyeShowShort: "顯示",
      stageSelectLayer: "編輯圖層 {0}",
      stageMoveHandle: "移動",
      editorLevel: "編輯模式",
      levelSimple: "快速自訂",
      levelAdvanced: "進階",
      inspectorTitle: "編輯主題",
      inspectorSections: "主題編輯分區",
      branchInterface: "介面",
      branchBackground: "背景",
      branchWidgets: "小工具",
      branchInterfaceDetail: "外觀與版面",
      branchBackgroundDetail: "畫布與圖片",
      branchWidgetsDetail: "Aura 控制項",
      branchInterfaceHelp: "介面工具：選取介面區域；圖片不會攔截點選。",
      branchBackgroundHelp: "背景工具：選取主題畫布或圖片；介面區域不會攔截點選。",
      branchWidgetsHelp: "小工具：在專用預覽中選取 Aura 控制項。",
      targetPicker: "編輯項目",
      editingContext: "正在編輯",
      appliesToContext: "套用範圍",
      sourceContext: "來源",
      editTargetContext: "編輯尺寸",
      documentDetails: "文件資訊",
      targetInterfaceTheme: "整體介面",
      targetNewChatArea: "新對話區域",
      targetBackgroundCanvas: "主題畫布",
      targetBackgroundLayer: "圖片",
      targetAppIdentity: "App 識別",
      themeOriginalSource: "主題原始設定",
      customizedSource: "已自訂",
      allModesScope: "淺色與深色",
      allPagesScope: "所有頁面",
      frameStandard: "標準",
      frameWide: "寬螢幕",
      customFrameUses: "自訂預覽使用「{0}」設定",
      switchPreview: "切換預覽",
      advancedValuesNotice: "此項目在「進階」模式中還有其他設定。",
      reviewStates: "檢查不同狀態",
      matrixTitle: "所有狀態一覽",
      matrixHint: "點選某個狀態即可編輯。",
      hiddenInStageView: "不會顯示在目前預覽中 · {0}",
      copyFramingToWide: "將位置設定複製到「寬螢幕」",
      copyFramingToNormal: "將位置設定複製到「標準」",
      framingCopied: "構圖已複製到{0}。",
      stageNewChat: "新對話",
      stageConversation: "對話",
      stageShowZones: "顯示安全區域",
      stageKeyboardHelp: "在預覽中選取圖片或新對話區域。拖曳可移動，拖曳控制點可調整大小；方向鍵可精確微調。",
      stagePromptTag: "新對話區域",
      stageLayerAria: "圖片 {0}（{1}）。方向鍵可移動，加號和減號可調整大小。",
      stagePromptAria: "新對話區域。用方向鍵移動，中括號鍵調整寬度。",
      stageEmpty: "此預覽未使用任何圖片。",
      stageSelectedAnnounce: "已選取{0}。",
      stageScaleHandle: "縮放圖片",
      stageWidthHandle: "調整新對話區域大小",
      promptTemplate: "建立一張{0}主題圖片素材。主體：{1}。視覺方向：{2}。{3} 圖片只作裝飾；不要放入介面文字、控制項、他人品牌標誌、遠端資源或真實人物照片。請讓構圖在不同視窗大小下裁切後仍可使用。",
      launcherPromptTemplate: "建立一個可直接使用的{0}。主體：{1}。視覺方向：{2}。{3} 輸出一張 96×96 px 的正方形透明 PNG。圖案在 24–48 px 大小下仍要清楚可辨，並置於中央 72×72 px 的安全區域。不要放入文字、介面控制項、他人品牌標誌、遠端資源、真實人物照片、不透明背景、外框或圖片內建陰影。",
      promptFallbackSubject: "原創抽象圖案",
      promptFallbackStyle: "安靜、精緻，並讓介面內容保持清楚易讀",
      promptRuleBackground: "使用寬幅不透明場景，中央文字安全區域保持低細節。",
      promptRuleHero: "將主要主體放在右側 60% 範圍內，並使用乾淨的透明邊緣或柔和襯底。",
      promptRuleCorner: "使用透明構圖，讓圖片在視窗邊緣裁切後仍然自然完整。",
      promptRuleCard: "使用方形透明構圖，主體集中在右下方 40% 範圍內。",
      promptRuleBrand: "使用不含文字或他人品牌造型的小型原創平面標記。",
      promptRuleLauncher: "設計一個能代表主題的原創精簡圖示，用於浮動啟動器、標題列、工作列、系統匣、Studio，以及桌面和「開始」功能表中的 Aura 與 Aura Studio 捷徑。",
    },
  };

  const ID_PATTERN = /^[a-z][a-z0-9-]{1,39}$/;
  const LAYER_ID_PATTERN = /^layer-[a-f0-9]{32}$/;
  const SESSION_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
  const COLOR_PATTERN = /^#[0-9A-F]{6}$/;
  const LAUNCHER_ASSET_PATTERN = /^(?:assets\/theme-art\/(?:default|japanese-film-editorial|korean-prestige|cartoon-studio|anime-twilight|study-library|japanese-idol|korean-idol)\/launcher-mark\.png|launcher-mark\.png)$/;
  const PREVIEW_PATH_PATTERN = /^\/active\/(?:[a-z0-9][a-z0-9-]{0,63}\/)*[a-z0-9][a-z0-9-]{0,80}\.webp$/;
  const ACTIONS = new Set([
    "create-theme-copy", "begin-theme-edit", "set-theme-token", "set-theme-layer", "apply-theme-patch",
    "pick-theme-layer-image", "pick-theme-launcher-mark", "remove-theme-layer", "move-theme-layer", "undo-theme-edit",
    "redo-theme-edit", "save-theme-edit", "discard-theme-edit", "delete-user-theme",
  ]);
  const MODE_TOKEN_KEYS = Object.freeze([
    "canvas", "sidebar", "surface", "text", "accent", "border", "surfaceAlpha", "sidebarAlpha",
  ]);
  const STUDIO_STYLE_COLOR_KEYS = Object.freeze([
    "canvas", "sidebar", "surface", "raised", "text", "textSecondary", "textMuted",
    "sidebarText", "sidebarTextMuted", "accent", "accentText", "border", "focus",
  ]);
  const STUDIO_STYLE_MODE_KEYS = Object.freeze([
    ...STUDIO_STYLE_COLOR_KEYS, "surfaceAlpha", "sidebarAlpha",
  ]);
  const COLOR_TOKEN_KEYS = new Set(MODE_TOKEN_KEYS.slice(0, 6));
  const FONT_UI_IDS = Object.freeze(["system-sans", "humanist-sans", "rounded-sans"]);
  const FONT_DISPLAY_IDS = Object.freeze([...FONT_UI_IDS, "editorial-serif"]);
  const SHADOW_IDS = Object.freeze(["none", "soft", "elevated"]);
  const THEME_ORIGINAL = "theme-original";
  const ROLE_IDS = Object.freeze(["background", "hero", "corner", "decoration"]);
  const APPEARANCE_IDS = Object.freeze(["all", "light", "dark"]);
  const CONTEXT_IDS = Object.freeze(["all", "new-chat", "conversation"]);
  const VIEWPORT_IDS = Object.freeze(["all", "normal", "wide"]);
  const MASK_IDS = Object.freeze(["none", "soft-right"]);
  const MOBILE_IDS = Object.freeze(["keep", "reduce", "hide"]);
  const ANCHOR_IDS = Object.freeze([
    "top-left", "top", "top-right", "left", "center", "right", "bottom-left", "bottom", "bottom-right",
  ]);
  const ANCHOR_OPTIONS = Object.freeze([
    ["top-left", "anchorTopLeft"], ["top", "anchorTop"], ["top-right", "anchorTopRight"],
    ["left", "anchorLeft"], ["center", "anchorCenter"], ["right", "anchorRight"],
    ["bottom-left", "anchorBottomLeft"], ["bottom", "anchorBottom"], ["bottom-right", "anchorBottomRight"],
  ]);
  const CONTRAST_IDS = new Set([
    "canvas-text", "surface-text", "muted-text", "accent-outline", "accent-text", "sidebar-text", "focus",
  ]);
  const CONTRAST_LABEL_KEYS = Object.freeze({
    "canvas-text": "contrastCanvasText",
    "surface-text": "contrastSurfaceText",
    "muted-text": "contrastMutedText",
    "accent-outline": "contrastAccentOutline",
    "accent-text": "contrastAccentText",
    "sidebar-text": "contrastSidebarText",
    focus: "contrastFocus",
  });
  const TOKEN_GROUPS = Object.freeze([
    { label: "groupCanvas", fields: [["canvas", "canvasColor"]] },
    { label: "groupSidebar", fields: [["sidebar", "sidebarColor"], ["sidebarAlpha", "sidebarAlpha"]] },
    { label: "groupSurface", fields: [["surface", "surfaceColor"], ["surfaceAlpha", "surfaceAlpha"]] },
    { label: "groupText", fields: [["text", "textColor"]] },
    { label: "groupAccent", fields: [["accent", "accentColor"]] },
    { label: "groupBorder", fields: [["border", "borderColor"]] },
  ]);
  const FONT_UI_OPTIONS = Object.freeze([
    ["system-sans", "fontSystemSans"], ["humanist-sans", "fontHumanistSans"], ["rounded-sans", "fontRoundedSans"],
  ]);
  const FONT_DISPLAY_OPTIONS = Object.freeze([
    ...FONT_UI_OPTIONS, ["editorial-serif", "fontEditorialSerif"],
  ]);
  const SHADOW_OPTIONS = Object.freeze([
    ["none", "shadowNone"], ["soft", "shadowSoft"], ["elevated", "shadowElevated"],
  ]);
  const SLOT_OPTIONS = Object.freeze([
    ["background", "slotBackground"], ["hero", "slotHero"],
    ["corner-top-right", "slotCornerTopRight"], ["corner-bottom", "slotCornerBottom"],
    ["card-1", "slotCard1"], ["card-2", "slotCard2"], ["card-3", "slotCard3"],
    ["brand-mark", "slotBrandMark"], ["launcher-mark", "slotLauncherMark"],
  ]);

  // Stage geometry mirrors assets/renderer-inject.js: the live renderer marks
  // its effective normal/wide viewport, anchors are container percentage
  // points, and framed images keep their natural pixel size inside a uniformly
  // scaled logical canvas. The logical sizes equal the host's set-aura-preview
  // client sizes so the stage and the real Aura window show the same geometry.
  const STAGE_SIZES = Object.freeze({ normal: [1180, 640], wide: [1560, 940] });
  const STAGE_SIDEBAR_WIDTH = 280;
  const STAGE_PROMPT_HEIGHT = 140;
  const ANCHOR_POINTS = Object.freeze({
    "top-left": [0, 0], top: [50, 0], "top-right": [100, 0],
    left: [0, 50], center: [50, 50], right: [100, 50],
    "bottom-left": [0, 100], bottom: [50, 100], "bottom-right": [100, 100],
  });
  const STAGE_FONT_STACKS = Object.freeze({
    "system-sans": 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    "humanist-sans": '"Segoe UI", "Hiragino Sans", "Yu Gothic UI", system-ui, sans-serif',
    "rounded-sans": '"Trebuchet MS", "Segoe UI", system-ui, sans-serif',
    "editorial-serif": 'ui-serif, Georgia, "Times New Roman", serif',
  });
  const STAGE_SHADOWS = Object.freeze({
    none: "none",
    soft: "0 18px 42px rgb(20 18 12 / 0.16)",
    elevated: "0 30px 72px rgb(20 18 12 / 0.28)",
  });
  const STAGE_LAYER_PATHS = Object.freeze(["positionX", "positionY", "scale"]);
  const STAGE_PROMPT_TOKENS = Object.freeze({ width: "promptWidth", x: "promptX", y: "promptY" });
  const STAGE_PROMPT_PATHS = Object.freeze([
    "shared.prompt.x", "shared.prompt.y", "shared.prompt.width",
  ]);
  const CONTRAST_TOKEN_MAP = Object.freeze({
    canvas: ["canvas-text"],
    surface: ["surface-text", "muted-text"],
    text: ["canvas-text", "surface-text", "sidebar-text"],
    accent: ["accent-outline", "accent-text", "focus"],
    sidebar: ["sidebar-text"],
    border: [],
  });

  // Shared by the stage and the state matrix so every scene uses one geometry.
  const promptRect = (logicalWidth, logicalHeight, widthRatio, xRatio, yRatio) => {
    const mainLeft = STAGE_SIDEBAR_WIDTH;
    const mainWidth = logicalWidth - STAGE_SIDEBAR_WIDTH;
    const width = Math.min(mainWidth - 32, Math.max(280, mainWidth * widthRatio));
    const center = mainLeft + (mainWidth / 2) + (mainWidth * xRatio);
    const left = Math.min(logicalWidth - 16 - width, Math.max(mainLeft + 16, center - (width / 2)));
    const top = Math.min(logicalHeight - 16 - STAGE_PROMPT_HEIGHT,
      Math.max(16, (logicalHeight * 0.56) + (logicalHeight * yRatio)));
    return { left, top, width, height: STAGE_PROMPT_HEIGHT };
  };

  // Renderer prompt offsets use the visible portion of Claude's main canvas,
  // after clipping it to the viewport. Keep the same bounds in Studio so a
  // ratio maps to the same live pixels even when the canvas starts offscreen
  // or is shorter than the WebView.
  const clampedMirrorMainMetrics = (main, logicalWidth, logicalHeight) => {
    if (!main || !Number.isFinite(logicalWidth) || !Number.isFinite(logicalHeight)
        || !["left", "top", "width", "height"].every((key) => Number.isFinite(main[key]))) return null;
    const left = Math.max(0, main.left);
    const top = Math.max(0, main.top);
    const right = Math.min(logicalWidth, main.left + main.width);
    const bottom = Math.min(logicalHeight, main.top + main.height);
    const width = right - left;
    const height = bottom - top;
    return width > 100 && height > 100 ? { left, top, width, height } : null;
  };

  const plainRecord = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
  const finite = (value) => typeof value === "number" && Number.isFinite(value);
  const inRange = (value, minimum, maximum) => finite(value) && value >= minimum && value <= maximum;
  const integer = (value, minimum, maximum) => Number.isInteger(value) && value >= minimum && value <= maximum;
  const exactShape = (value, required, optional = []) => {
    if (!plainRecord(value)) return false;
    const allowed = new Set([...required, ...optional]);
    const keys = Object.keys(value);
    return required.every((key) => Object.hasOwn(value, key)) && keys.every((key) => allowed.has(key));
  };
  const enumValue = (value, values) => typeof value === "string" && values.includes(value);
  const safeText = (value, maximum, { empty = false } = {}) => {
    if (typeof value !== "string" || value.length > maximum) return null;
    const text = value.trim();
    return text || (empty ? "" : null);
  };
  const format = (template, ...values) => values.reduce(
    (result, value, index) => result.replaceAll(`{${index}}`, String(value)), template);
  const formatBytes = (value) => value >= 1_000_000
    ? `${(value / 1_000_000).toFixed(2)} MB`
    : `${Math.max(0, Math.round(value / 1000))} KB`;

  const CAPABILITY_BRANCHES = Object.freeze(["interface", "background", "widgets"]);
  const CAPABILITY_VIEWS = Object.freeze(["new-chat", "conversation"]);
  const CAPABILITY_AXES = Object.freeze(["appearance", "view", "frame"]);
  const CAPABILITY_CAPTURE_GEOMETRY = Object.freeze([
    "none", "full-canvas", "new-chat-area", "artwork-layer", "local-preview",
  ]);
  const CAPABILITY_SELECTION_BEHAVIOR = Object.freeze([
    "picker", "stage-prompt", "stage-layer",
  ]);
  const CAPABILITY_TARGETS = Object.freeze({
    "interface.theme": Object.freeze({ branch: "interface", labelKey: "targetInterfaceTheme" }),
    "interface.new-chat-area": Object.freeze({ branch: "interface", labelKey: "targetNewChatArea" }),
    "background.canvas": Object.freeze({ branch: "background", labelKey: "targetBackgroundCanvas" }),
    "background.layer": Object.freeze({ branch: "background", labelKey: "targetBackgroundLayer" }),
    "widgets.app-identity": Object.freeze({ branch: "widgets", labelKey: "targetAppIdentity" }),
  });

  function normalizeCapabilityRegistry(value) {
    if (!Array.isArray(value) || value.length !== Object.keys(CAPABILITY_TARGETS).length) return null;
    const normalized = [];
    const ids = new Set();
    for (const entry of value) {
      if (!exactShape(entry, [
        "id", "branch", "views", "axes", "captureGeometry", "selectionBehavior",
      ]) || !Object.hasOwn(CAPABILITY_TARGETS, entry.id)
          || CAPABILITY_TARGETS[entry.id].branch !== entry.branch
          || !CAPABILITY_BRANCHES.includes(entry.branch)
          || !Array.isArray(entry.views) || !entry.views.length
          || !Array.isArray(entry.axes)
          || !CAPABILITY_CAPTURE_GEOMETRY.includes(entry.captureGeometry)
          || !CAPABILITY_SELECTION_BEHAVIOR.includes(entry.selectionBehavior)
          || ids.has(entry.id)) return null;
      if (entry.views.some((view) => !CAPABILITY_VIEWS.includes(view))
          || new Set(entry.views).size !== entry.views.length
          || entry.axes.some((axis) => !CAPABILITY_AXES.includes(axis))
          || new Set(entry.axes).size !== entry.axes.length) return null;
      ids.add(entry.id);
      normalized.push(Object.freeze({
        id: entry.id,
        branch: entry.branch,
        views: Object.freeze([...entry.views]),
        axes: Object.freeze([...entry.axes]),
        captureGeometry: entry.captureGeometry,
        selectionBehavior: entry.selectionBehavior,
      }));
    }
    if (Object.keys(CAPABILITY_TARGETS).some((id) => !ids.has(id))) return null;
    return Object.freeze(normalized);
  }

  const EDITOR_CAPABILITY_REGISTRY = normalizeCapabilityRegistry([
    {
      id: "interface.theme",
      branch: "interface",
      views: ["new-chat", "conversation"],
      axes: ["appearance"],
      captureGeometry: "none",
      selectionBehavior: "picker",
    },
    {
      id: "interface.new-chat-area",
      branch: "interface",
      views: ["new-chat"],
      axes: ["frame"],
      captureGeometry: "new-chat-area",
      selectionBehavior: "stage-prompt",
    },
    {
      id: "background.canvas",
      branch: "background",
      views: ["new-chat", "conversation"],
      axes: ["appearance", "view"],
      captureGeometry: "full-canvas",
      selectionBehavior: "picker",
    },
    {
      id: "background.layer",
      branch: "background",
      views: ["new-chat", "conversation"],
      axes: ["appearance", "view", "frame"],
      captureGeometry: "artwork-layer",
      selectionBehavior: "stage-layer",
    },
    {
      id: "widgets.app-identity",
      branch: "widgets",
      views: ["new-chat", "conversation"],
      axes: [],
      captureGeometry: "local-preview",
      selectionBehavior: "picker",
    },
  ]);
  if (!EDITOR_CAPABILITY_REGISTRY) throw new Error("Invalid Aura editor capability registry");
  const CAPABILITY_BY_ID = new Map(EDITOR_CAPABILITY_REGISTRY.map((entry) => [entry.id, entry]));

  function normalizePreviewUrl(value) {
    if (value === null) return null;
    if (typeof value !== "string" || value.length > 320) return undefined;
    try {
      const url = new URL(value);
      if (url.origin !== "https://aura.editor" || url.username || url.password
          || !PREVIEW_PATH_PATTERN.test(url.pathname)) return undefined;
      if (!/^\?v=[a-f0-9]{32,64}$/.test(url.search) || url.hash) return undefined;
      return url.href;
    } catch { return undefined; }
  }

  function normalizeModeTokens(value) {
    if (!exactShape(value, MODE_TOKEN_KEYS)) return null;
    const result = Object.create(null);
    for (const key of MODE_TOKEN_KEYS) {
      if (COLOR_TOKEN_KEYS.has(key)) {
        if (typeof value[key] !== "string" || !COLOR_PATTERN.test(value[key])) return null;
        result[key] = value[key];
      } else {
        const minimum = key === "surfaceAlpha" ? 0.35 : 0.62;
        if (!inRange(value[key], minimum, 1)) return null;
        result[key] = value[key];
      }
    }
    return result;
  }

  function normalizeShared(value) {
    const keys = ["fontUi", "fontDisplay", "radius", "blur", "shadow", "backgroundScope", "prompt", "inherited"];
    const inheritedKeys = ["fontUi", "fontDisplay", "radius", "shadow"];
    if (!exactShape(value, keys) || !exactShape(value.prompt, ["native", "width", "x", "y"])
        || !exactShape(value.inherited, inheritedKeys)
        || inheritedKeys.some((key) => typeof value.inherited[key] !== "boolean")) return null;
    if (!enumValue(value.fontUi, FONT_UI_IDS) || !enumValue(value.fontDisplay, FONT_DISPLAY_IDS)
        || !inRange(value.radius, 0, 32) || !inRange(value.blur, 0, 40)
        || !enumValue(value.shadow, SHADOW_IDS) || !enumValue(value.backgroundScope, ["content", "full-window"])
        || !inRange(value.prompt.width, 0.4, 0.96) || !inRange(value.prompt.x, -0.35, 0.35)
        || typeof value.prompt.native !== "boolean"
        || !inRange(value.prompt.y, -0.3, 0.3)) return null;
    return {
      fontUi: value.fontUi,
      fontDisplay: value.fontDisplay,
      radius: value.radius,
      blur: value.blur,
      shadow: value.shadow,
      backgroundScope: value.backgroundScope,
      prompt: {
        native: value.prompt.native,
        width: value.prompt.width,
        x: value.prompt.x,
        y: value.prompt.y,
      },
      inherited: {
        fontUi: value.inherited.fontUi,
        fontDisplay: value.inherited.fontDisplay,
        radius: value.inherited.radius,
        shadow: value.inherited.shadow,
      },
    };
  }

  function normalizeStudioStyle(value) {
    if (!exactShape(value, ["light", "dark", "shared"])
        || !exactShape(value.shared, ["fontUi", "fontDisplay", "radius", "blur", "shadow"])) return null;
    const modes = Object.create(null);
    for (const mode of ["light", "dark"]) {
      const source = value[mode];
      if (!exactShape(source, STUDIO_STYLE_MODE_KEYS)) return null;
      const normalized = Object.create(null);
      for (const key of STUDIO_STYLE_COLOR_KEYS) {
        if (typeof source[key] !== "string" || !COLOR_PATTERN.test(source[key])) return null;
        normalized[key] = source[key];
      }
      if (!inRange(source.surfaceAlpha, 0, 1) || !inRange(source.sidebarAlpha, 0, 1)) return null;
      normalized.surfaceAlpha = source.surfaceAlpha;
      normalized.sidebarAlpha = source.sidebarAlpha;
      modes[mode] = normalized;
    }
    if (!enumValue(value.shared.fontUi, FONT_UI_IDS)
        || !enumValue(value.shared.fontDisplay, FONT_DISPLAY_IDS)
        || !inRange(value.shared.radius, 0, 32) || !inRange(value.shared.blur, 0, 40)
        || !enumValue(value.shared.shadow, SHADOW_IDS)) return null;
    return {
      light: modes.light,
      dark: modes.dark,
      shared: {
        fontUi: value.shared.fontUi,
        fontDisplay: value.shared.fontDisplay,
        radius: value.shared.radius,
        blur: value.shared.blur,
        shadow: value.shared.shadow,
      },
    };
  }

  function normalizeLauncher(value) {
    const keys = [
      "asset", "surface", "surfaceHover", "foreground", "accent", "border", "radius", "borderWidth",
    ];
    if (!exactShape(value, keys) || typeof value.asset !== "string"
        || !LAUNCHER_ASSET_PATTERN.test(value.asset) || !inRange(value.radius, 8, 24)
        || !inRange(value.borderWidth, 1, 3)) return null;
    for (const key of ["surface", "surfaceHover", "foreground", "accent", "border"]) {
      if (typeof value[key] !== "string" || !COLOR_PATTERN.test(value[key])) return null;
    }
    return { ...value };
  }

  function normalizeLauncherPreviewUrl(value) {
    if (typeof value !== "string") return null;
    if (/^https:\/\/aura\.assets\/(?:default|japanese-film-editorial|korean-prestige|cartoon-studio|anime-twilight|study-library|japanese-idol|korean-idol)\/launcher-mark\.png$/.test(value)) return value;
    if (/^https:\/\/aura\.editor\/active\/launcher-[a-f0-9]{64}\.png$/.test(value)) return value;
    return null;
  }

  function normalizeFrame(value) {
    const keys = ["anchor", "focalX", "focalY", "positionX", "positionY", "scale"];
    if (!exactShape(value, keys) || !enumValue(value.anchor, ANCHOR_IDS)
        || !inRange(value.focalX, 0, 100) || !inRange(value.focalY, 0, 100)
        || !inRange(value.positionX, -100, 100) || !inRange(value.positionY, -100, 100)
        || !inRange(value.scale, 0.25, 3)) return null;
    return { ...value };
  }

  function normalizeLayer(value, expectedIndex) {
    const keys = [
      "id", "index", "role", "appearance", "context", "viewport", "visible", "opacity", "mask", "mobile",
      "bytes", "previewUrl", "frames",
    ];
    if (!exactShape(value, keys) || !LAYER_ID_PATTERN.test(value.id)
        || value.index !== expectedIndex || !integer(value.index, 0, 7)
        || !enumValue(value.role, ROLE_IDS) || !enumValue(value.appearance, APPEARANCE_IDS)
        || !enumValue(value.context, CONTEXT_IDS) || !enumValue(value.viewport, VIEWPORT_IDS)
        || typeof value.visible !== "boolean" || !inRange(value.opacity, 0, 1)
        || !enumValue(value.mask, MASK_IDS) || !enumValue(value.mobile, MOBILE_IDS)
        || !integer(value.bytes, 0, 400_000) || !exactShape(value.frames, ["normal", "wide"])) return null;
    const previewUrl = normalizePreviewUrl(value.previewUrl);
    const normal = normalizeFrame(value.frames.normal);
    const wide = normalizeFrame(value.frames.wide);
    if (previewUrl === undefined || !normal || !wide) return null;
    return { ...value, previewUrl, frames: { normal, wide } };
  }

  function normalizeMetadata(value) {
    const locales = ["en", "zh-CN", "zh-TW"];
    if (!exactShape(value, ["labels", "descriptions"])
        || !exactShape(value.labels, locales) || !exactShape(value.descriptions, locales)) return null;
    const labels = Object.create(null);
    const descriptions = Object.create(null);
    for (const locale of locales) {
      labels[locale] = safeText(value.labels[locale], 80);
      descriptions[locale] = safeText(value.descriptions[locale], 220);
      if (!labels[locale] || !descriptions[locale]) return null;
    }
    return { labels, descriptions };
  }

  function normalizeContrast(value) {
    if (!exactShape(value, ["light", "dark"])) return null;
    const result = {};
    for (const mode of ["light", "dark"]) {
      if (!Array.isArray(value[mode]) || value[mode].length > 16) return null;
      result[mode] = [];
      for (const item of value[mode]) {
        if (!exactShape(item, ["id", "ratio", "minimum", "pass"])
            || !CONTRAST_IDS.has(item.id) || !inRange(item.ratio, 0, 21)
            || !inRange(item.minimum, 1, 21) || typeof item.pass !== "boolean") return null;
        result[mode].push({ ...item });
      }
    }
    return result;
  }

  function normalizeBudget(value) {
    const scalarKeys = [
      "chromeBytes", "chromeLimit", "embeddedArtworkBytes", "embeddedArtworkLimit",
      "sourceArtworkBytes", "sourceArtworkLimit", "pass",
    ];
    if (!exactShape(value, [...scalarKeys, "layers"]) || typeof value.pass !== "boolean"
        || !Array.isArray(value.layers) || value.layers.length > 8) return null;
    for (const key of scalarKeys.slice(0, -1)) {
      if (!integer(value[key], 0, 10_000_000)) return null;
    }
    const layers = [];
    for (const layer of value.layers) {
      if (!exactShape(layer, ["id", "bytes", "limit", "pass"])
          || !integer(layer.id, 0, 7) || !integer(layer.bytes, 0, 10_000_000)
          || !integer(layer.limit, 1, 10_000_000) || typeof layer.pass !== "boolean") return null;
      layers.push({ ...layer });
    }
    return { ...value, layers };
  }

  function normalizeFeedback(value) {
    if (!exactShape(value, ["valid", "contrast", "budget", "errors"])
        || typeof value.valid !== "boolean" || !Array.isArray(value.errors) || value.errors.length > 64) return null;
    const contrast = normalizeContrast(value.contrast);
    const budget = normalizeBudget(value.budget);
    if (!contrast || !budget) return null;
    const errors = [];
    for (const error of value.errors) {
      if (!exactShape(error, ["code", "field"])) return null;
      const code = safeText(error.code, 80);
      const field = safeText(error.field, 160);
      if (!code || !/^[a-z0-9-]+$/.test(code) || !field || !/^[a-zA-Z0-9_.\-[\]]+$/.test(field)) return null;
      errors.push({ code, field });
    }
    return { valid: value.valid, contrast, budget, errors };
  }

  function normalizeEditorState(value) {
    if (value === null) return null;
    if (!plainRecord(value) || typeof value.active !== "boolean") return undefined;
    const optional = ["lastAction", "actionSucceeded", "error"];
    if (!value.active) {
      if (!exactShape(value, ["active"], optional)) return undefined;
      if (value.lastAction !== undefined && !ACTIONS.has(value.lastAction)) return undefined;
      if (value.actionSucceeded !== undefined && typeof value.actionSucceeded !== "boolean") return undefined;
      if (value.error !== undefined && value.error !== null && !safeText(value.error, 500)) return undefined;
      return { ...value };
    }
    const required = [
      "active", "id", "sourceId", "source", "isNew", "session", "revision", "dirty", "canUndo", "canRedo",
      "label", "metadata", "tokens", "studioStyle", "launcher", "launcherStyle", "launcherPreviewUrl",
      "launcherStylePreviewUrl", "shared", "layers", "feedback",
    ];
    if (!exactShape(value, required, optional) || !ID_PATTERN.test(value.id)
        || !ID_PATTERN.test(value.sourceId) || !enumValue(value.source, ["user", "builtin"])
        || typeof value.isNew !== "boolean" || typeof value.session !== "string" || !SESSION_PATTERN.test(value.session)
        || !integer(value.revision, 0, Number.MAX_SAFE_INTEGER) || typeof value.dirty !== "boolean"
        || typeof value.canUndo !== "boolean" || typeof value.canRedo !== "boolean") return undefined;
    const label = safeText(value.label, 80);
    if (!label || !exactShape(value.tokens, ["light", "dark"])) return undefined;
    const metadata = normalizeMetadata(value.metadata);
    const light = normalizeModeTokens(value.tokens.light);
    const dark = normalizeModeTokens(value.tokens.dark);
    const studioStyle = normalizeStudioStyle(value.studioStyle);
    const launcher = normalizeLauncher(value.launcher);
    const launcherStyle = normalizeLauncher(value.launcherStyle);
    const launcherPreviewUrl = normalizeLauncherPreviewUrl(value.launcherPreviewUrl);
    const launcherStylePreviewUrl = normalizeLauncherPreviewUrl(value.launcherStylePreviewUrl);
    const shared = normalizeShared(value.shared);
    if (!metadata || !light || !dark || !studioStyle || !launcher || !launcherStyle
        || !launcherPreviewUrl || !launcherStylePreviewUrl || !shared
        || !Array.isArray(value.layers) || value.layers.length > 8) return undefined;
    const layers = value.layers.map(normalizeLayer);
    const feedback = normalizeFeedback(value.feedback);
    if (layers.some((layer) => !layer) || new Set(layers.map((layer) => layer.id)).size !== layers.length
        || !feedback) return undefined;
    if (value.lastAction !== undefined && !ACTIONS.has(value.lastAction)) return undefined;
    if (value.actionSucceeded !== undefined && typeof value.actionSucceeded !== "boolean") return undefined;
    if (value.error !== undefined && value.error !== null && !safeText(value.error, 500)) return undefined;
    return {
      ...value,
      label,
      metadata,
      tokens: { light, dark },
      studioStyle,
      launcher,
      launcherStyle,
      launcherPreviewUrl,
      launcherStylePreviewUrl,
      shared,
      layers,
      feedback,
    };
  }

  const hasUnsavedEditorWork = (work) => Boolean(
    work.dirty
    || work.deferred
    || work.coalesced
    || work.debounce
    || work.inFlight
    || work.stageKeys
    || work.stageKeyDebounce
  );

  function createController({ locale, send, setStatus, translate, focusThemeCard, onStudioStyleChange }) {
    const normalizedLocale = Object.hasOwn(STRINGS, locale) ? locale : "en";
    const tr = (key) => STRINGS[normalizedLocale][key] ?? translate?.(key) ?? STRINGS.en[key] ?? key;
    const editor = document.getElementById("editor");
    const navEditor = document.getElementById("nav-editor");
    const ordinarySections = ["themes", "background", "create", "settings"].map((id) => document.getElementById(id));
    const ordinaryLinks = [...document.querySelectorAll(".rail-item")].filter((link) => link !== navEditor);
    const studioShell = document.querySelector(".studio");
    const content = document.querySelector(".content");
    const stageColumn = editor.querySelector(".editor-stagecol");
    const editorControls = editor.querySelector(".editor-controls");
    const title = document.getElementById("editor-title");
    const summary = document.getElementById("editor-summary");
    const dirtyPill = document.getElementById("editor-dirty");
    const validPill = document.getElementById("editor-valid");
    const live = document.getElementById("editor-live");
    const errorSummary = document.getElementById("editor-error-summary");
    const tokenGroups = document.getElementById("editor-token-groups");
    const layerList = document.getElementById("editor-layer-list");
    const feedbackRoot = document.getElementById("editor-feedback");
    const quickFeedback = document.getElementById("editor-quick-feedback");
    const inspectorHead = editor.querySelector(".editor-inspector-head");
    const promptContextSection = editor.querySelector(".editor-prompt-context");
    const promptContextUnavailable = editor.querySelector(".editor-prompt-unavailable");
    const confirmDialog = document.getElementById("editor-confirm-dialog");
    const confirmTitle = document.getElementById("editor-confirm-title");
    const confirmBody = document.getElementById("editor-confirm-body");
    const confirmAction = document.getElementById("editor-confirm-action");
    const modeInputs = [...document.querySelectorAll('input[name="editor-mode"]')];
    const scopeInputs = [...document.querySelectorAll('input[name="background-scope"]')];
    const sharedInputs = [...document.querySelectorAll("[data-editor-shared]")];
    const radiusInput = document.getElementById("editor-radius");
    const inheritedRadiusNote = document.getElementById("editor-radius-inherited");
    const nativePromptNote = document.getElementById("editor-prompt-native");
    const launcherInputs = [...document.querySelectorAll("[data-editor-launcher]")];
    const launcherTextInputs = [...document.querySelectorAll("[data-editor-launcher-text]")];
    const launcherPreview = document.getElementById("editor-launcher-preview");
    const launcherMark = document.getElementById("editor-launcher-mark");
    const replaceLauncherMarkButton = document.getElementById("editor-launcher-replace");
    const promptInputs = [...document.querySelectorAll("[data-editor-prompt]")];
    const promptExactInputs = [...document.querySelectorAll("[data-editor-prompt-exact]")];
    const saveButton = document.getElementById("editor-save");
    const cancelButton = document.getElementById("editor-cancel");
    const undoButton = document.getElementById("editor-undo");
    const redoButton = document.getElementById("editor-redo");
    const resetButton = document.getElementById("editor-reset");
    const addLayerButton = document.getElementById("editor-add-layer");
    const addLayerRoleSelect = document.getElementById("editor-add-layer-role");
    const backButton = document.getElementById("editor-back");
    const topmostButton = document.getElementById("stage-real-topmost");
    const metadataInputs = [...document.querySelectorAll("[data-editor-metadata]")];
    const branchTabs = [...document.querySelectorAll("[data-editor-branch-target]")];
    const branchHelp = document.getElementById("editor-branch-help");
    const targetPicker = document.getElementById("editor-target-picker");
    const contextEditing = document.getElementById("editor-context-editing");
    const contextApplies = document.getElementById("editor-context-applies");
    const contextSource = document.getElementById("editor-context-source");
    const contextFrame = document.getElementById("editor-context-frame");
    const contextFrameRow = document.getElementById("editor-context-frame-row");
    const documentDetails = document.getElementById("editor-document-details");
    const switchSupportedPreviewButton = document.getElementById("editor-switch-supported-preview");
    const stageRoot = document.getElementById("editor-stage");
    for (const input of metadataInputs) {
      if (input.dataset.editorMetadata === "label" && input.dataset.editorLocale !== normalizedLocale) {
        input.closest(".editor-field")?.classList.add("advanced-only");
      }
    }
    let state = null;
    let selectedMode = "light";
    let selectedLayerId = null;
    let renderedLayerSignature = null;
    let inspectorBranch = "interface";
    let inspectorTarget = "interface.theme";
    const targetByBranch = {
      interface: "interface.theme",
      background: "background.canvas",
      widgets: "widgets.app-identity",
    };
    let stageViewport = "normal";
    let stageContext = "new-chat";
    let stageSelection = null;
    let stagePreviewSize = [...STAGE_SIZES.normal];
    let previewSizeIntent = null;
    let pendingAction = null;
    let returnTheme = "default";
    let confirmCallback = null;
    let confirmReturnFocus = null;
    let firstOpen = true;
    let entryAppearance = null;
    let appearanceTouched = false;
    let topmostEnabled = false;
    const coalescedChanges = new Map();
    const deferredChanges = new Map();
    let changeFlushTimer = null;
    let inFlightChanges = [];
    let inFlightRevision = null;
    let inFlightSession = null;
    let actionAfterPatch = null;
    const hasUnsavedEdits = () => hasUnsavedEditorWork({
      dirty: state?.dirty,
      deferred: deferredChanges.size,
      coalesced: coalescedChanges.size,
      debounce: changeFlushTimer,
      inFlight: inFlightChanges.length,
      stageKeys: stageKeyPaths.size,
      stageKeyDebounce: stageKeyTimer,
    });
    const reflectDirtyState = () => {
      if (!state) return;
      const locallyDirty = hasUnsavedEdits();
      dirtyPill.textContent = locallyDirty ? tr("unsavedState") : tr("savedState");
      dirtyPill.dataset.state = locallyDirty ? "dirty" : "saved";
      refreshInspectorContext();
    };

    const announce = (message, tone = "ok") => {
      live.textContent = message;
      setStatus?.(message, tone);
    };

    const applyTranslations = () => {
      for (const node of document.querySelectorAll("[data-editor-i18n]")) {
        node.textContent = tr(node.dataset.editorI18n);
      }
      for (const node of document.querySelectorAll("[data-editor-i18n-aria-label]")) {
        node.setAttribute("aria-label", tr(node.dataset.editorI18nAriaLabel));
      }
    };

    const fillSelect = (select, values) => {
      select.replaceChildren(...values.map(([value, key]) => {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = tr(key);
        return option;
      }));
    };

    const setInheritedSelectPresentation = (select, inherited, value) => {
      let option = select.querySelector("option[data-editor-inherited-option]");
      if (!inherited) {
        option?.remove();
        delete select.dataset.inherited;
        select.value = String(value);
        return;
      }
      if (!option) {
        option = document.createElement("option");
        option.value = THEME_ORIGINAL;
        option.disabled = true;
        option.dataset.editorInheritedOption = "true";
        select.prepend(option);
      }
      option.textContent = tr("themeOriginal");
      option.selected = true;
      select.dataset.inherited = "true";
    };

    const setInheritedRadiusPresentation = (inherited) => {
      radiusInput.dataset.inherited = String(inherited);
      inheritedRadiusNote.hidden = !inherited;
    };

    // A structural/replacing host action (layer reorder, image pick, save,
    // undo, reset) that must settle before further interaction. Value patches
    // (apply-theme-patch) never change layer structure, so they sync in the
    // background without locking the editor.
    const isBlockingAction = () => Boolean(pendingAction) && pendingAction !== "apply-theme-patch";
    const setPending = (action = null) => {
      pendingAction = action;
      const blocking = Boolean(action) && action !== "apply-theme-patch";
      editor.setAttribute("aria-busy", String(blocking));
      // Only structural actions disable every control; per-control busy gating
      // in reflectButtonStates handles background patches without a full freeze.
      for (const button of editor.querySelectorAll("button")) button.disabled = blocking;
      reflectButtonStates();
    };

    const post = (message) => {
      if (message.type !== "apply-theme-patch" && (stageKeyPaths.size || stageKeyTimer)) {
        if (actionAfterPatch) return false;
        actionAfterPatch = { ...message };
        flushStageKeyChanges();
        if (!pendingAction && (coalescedChanges.size || changeFlushTimer)) flushThemeChanges();
        if (pendingAction || coalescedChanges.size || changeFlushTimer) {
          announce(tr("editorBusy"), "busy");
          return true;
        }
        actionAfterPatch = null;
      }
      if (message.type !== "apply-theme-patch" && (coalescedChanges.size || changeFlushTimer)) {
        if (actionAfterPatch) return false;
        actionAfterPatch = { ...message };
        flushThemeChanges();
        announce(tr("editorBusy"), "busy");
        return true;
      }
      if (pendingAction || !send(message)) return false;
      setPending(message.type);
      announce(tr("editorBusy"), "busy");
      return true;
    };

    const mutationBase = () => state ? { session: state.session, revision: state.revision } : null;
    const themeChangeKey = (change) => change.kind === "token"
      ? `token:${change.mode}:${change.token}`
      : change.kind === "layer"
        ? `layer:${change.layerId}:${change.preset}:${change.property}`
        : `metadata:${change.field}:${change.locale}`;
    const clearInFlightChanges = () => {
      inFlightChanges = [];
      inFlightRevision = null;
      inFlightSession = null;
    };
    const flushThemeChanges = () => {
      if (changeFlushTimer) {
        clearTimeout(changeFlushTimer);
        changeFlushTimer = null;
      }
      if (pendingAction || !coalescedChanges.size) return;
      const batch = [...coalescedChanges.entries()].slice(0, 16);
      const base = mutationBase();
      if (!base) {
        coalescedChanges.clear();
        return;
      }
      for (const [key] of batch) coalescedChanges.delete(key);
      inFlightChanges = batch.map(([, change]) => change);
      const wireChanges = inFlightChanges.map((change) => {
        if (change.kind !== "layer") return change;
        const index = layerIndexForId(change.layerId);
        if (index < 0) return null;
        return {
          kind: "layer", index, preset: change.preset,
          property: change.property, value: change.value,
        };
      }).filter(Boolean);
      if (!wireChanges.length) {
        clearInFlightChanges();
        reflectButtonStates();
        return;
      }
      inFlightRevision = base.revision;
      inFlightSession = base.session;
      if (!post({ type: "apply-theme-patch", ...base, changes: wireChanges })) {
        for (const [, change] of batch) coalescedChanges.set(themeChangeKey(change), change);
        clearInFlightChanges();
      }
      reflectButtonStates();
    };
    const queueThemeChanges = (changes, { immediate = false } = {}) => {
      for (const [key, change] of deferredChanges) {
        if (!coalescedChanges.has(key)) coalescedChanges.set(key, change);
      }
      deferredChanges.clear();
      for (const change of changes) coalescedChanges.set(themeChangeKey(change), change);
      if (changeFlushTimer) clearTimeout(changeFlushTimer);
      if (immediate && !pendingAction) flushThemeChanges();
      else changeFlushTimer = setTimeout(flushThemeChanges, 60);
      reflectButtonStates();
    };
    const queueThemeChange = (change, options) => queueThemeChanges([change], options);
    const queueTokenChange = (mode, token, value) => {
      queueThemeChange({ kind: "token", mode, token, value });
    };
    const queueLayerChange = (index, preset, property, value) => {
      const layerId = state?.layers?.[index]?.id;
      if (layerId) queueThemeChange({ kind: "layer", layerId, preset, property, value });
    };
    const requeueInFlightChanges = () => {
      for (const change of inFlightChanges) {
        const key = themeChangeKey(change);
        if (!coalescedChanges.has(key)) coalescedChanges.set(key, change);
      }
      clearInFlightChanges();
    };
    const deferInFlightChanges = () => {
      for (const change of inFlightChanges) {
        const key = themeChangeKey(change);
        if (!coalescedChanges.has(key) && !deferredChanges.has(key)) deferredChanges.set(key, change);
      }
      clearInFlightChanges();
    };
    const selectedArtworkRole = () => ROLE_IDS.includes(addLayerRoleSelect?.value)
      ? addLayerRoleSelect.value : "decoration";
    const launcherToken = (property) => `launcher${property[0].toUpperCase()}${property.slice(1)}`;
    const setCurrentNavigation = (active) => {
      navEditor.hidden = !active;
      for (const link of ordinaryLinks) {
        link.hidden = active;
        link.classList.toggle("is-current", !active && link.hash === "#themes");
        if (active) link.removeAttribute("aria-current");
      }
      navEditor.classList.toggle("is-current", active);
      if (active) navEditor.setAttribute("aria-current", "page");
      else navEditor.removeAttribute("aria-current");
    };

    const targetLabel = (target) => tr(CAPABILITY_TARGETS[target]?.labelKey ?? "targetPicker");
    const branchHelpKey = (branch) => ({
      interface: "branchInterfaceHelp",
      background: "branchBackgroundHelp",
      widgets: "branchWidgetsHelp",
    })[branch] ?? "branchInterfaceHelp";
    const stageSelectionTarget = (selection) => selection?.kind === "prompt"
      ? "interface.new-chat-area"
      : selection?.kind === "layer" ? "background.layer" : null;
    const stageSelectionAllowed = (selection) => {
      if (!selection) return true;
      const capability = CAPABILITY_BY_ID.get(stageSelectionTarget(selection));
      return Boolean(capability && capability.branch === inspectorBranch);
    };
    const setStageNodeInteractive = (node, interactive) => {
      if (!node) return;
      node.tabIndex = interactive ? 0 : -1;
      node.toggleAttribute("inert", !interactive);
      if (interactive) node.removeAttribute("aria-hidden");
      else node.setAttribute("aria-hidden", "true");
    };
    const syncStageSelectionMode = () => {
      if (branchHelp) branchHelp.textContent = tr(branchHelpKey(inspectorBranch));
      if (!stageRoot) return;
      stageRoot.dataset.selectionBranch = inspectorBranch;
      const prompt = stageRoot.querySelector(".stage-prompt");
      setStageNodeInteractive(prompt, inspectorBranch === "interface" && stageContext === "new-chat");
      for (const item of stageRoot.querySelectorAll(".stage-layer .stage-item")) {
        setStageNodeInteractive(item, inspectorBranch === "background");
      }
      const palette = stageRoot.querySelector(".stage-layers-panel");
      if (palette) palette.hidden = inspectorBranch !== "background";
      if (!stageSelectionAllowed(stageSelection)
          || (stageSelection && stageSelectionTarget(stageSelection) !== inspectorTarget)) {
        stageSelection = null;
      }
      if (!stageSelection) {
        for (const chip of stageRoot.querySelectorAll(".stage-chip")) chip.dataset.active = "false";
        for (const node of stageRoot.querySelectorAll(
          ".stage-hud-ring, .stage-edge, .stage-corner, .stage-opacity",
        )) node.hidden = true;
      }
    };
    const syncTargetPicker = () => {
      const entries = EDITOR_CAPABILITY_REGISTRY.filter((entry) => entry.branch === inspectorBranch);
      targetPicker.replaceChildren(...entries.map((entry) => {
        const option = document.createElement("option");
        option.value = entry.id;
        option.textContent = targetLabel(entry.id);
        return option;
      }));
      targetPicker.value = inspectorTarget;
    };
    const layerScopeLabel = (layer) => {
      if (!layer) return tr("allPagesScope");
      const appearance = layer.appearance === "all" ? tr("allModesScope")
        : tr(layer.appearance === "dark" ? "appearanceDark" : "appearanceLight");
      const page = layer.context === "all" ? tr("allPagesScope")
        : tr(layer.context === "conversation" ? "contextConversation" : "contextNewChat");
      const frame = layer.viewport === "all"
        ? `${tr("frameStandard")} + ${tr("frameWide")}`
        : tr(layer.viewport === "wide" ? "frameWide" : "frameStandard");
      return `${appearance} · ${page} · ${frame}`;
    };
    const refreshInspectorContext = () => {
      const capability = CAPABILITY_BY_ID.get(inspectorTarget);
      if (!capability) return;
      const selectedLayer = state?.layers?.find((layer) => layer.id === selectedLayerId) ?? null;
      contextEditing.textContent = inspectorTarget === "background.layer" && selectedLayer
        ? format(tr("layerNumber"), selectedLayer.index + 1)
        : targetLabel(inspectorTarget);
      contextApplies.textContent = inspectorTarget === "interface.theme"
        ? `${tr(selectedMode === "dark" ? "appearanceDark" : "appearanceLight")} · ${tr("allPagesScope")}`
        : inspectorTarget === "interface.new-chat-area"
          ? `${tr("contextNewChat")} · ${tr(stageViewport === "wide" ? "frameWide" : "frameStandard")}`
          : inspectorTarget === "background.layer"
            ? layerScopeLabel(selectedLayer)
            : `${tr("allModesScope")} · ${tr("allPagesScope")}`;
      contextSource.textContent = state && hasUnsavedEdits()
        ? tr("customizedSource") : tr("themeOriginalSource");
      contextFrameRow.hidden = !capability.axes.includes("frame");
      const frameLabel = tr(stageViewport === "wide" ? "frameWide" : "frameStandard");
      const preset = Object.values(STAGE_SIZES).some(
        ([width, height]) => width === stagePreviewSize[0] && height === stagePreviewSize[1],
      );
      contextFrame.textContent = preset ? frameLabel : format(tr("customFrameUses"), frameLabel);
      const available = capability.views.includes(stageContext);
      editor.dataset.targetAvailable = String(available);
    };
    const setInspectorTarget = (target, { focusBranch = false, reveal = false } = {}) => {
      const capability = CAPABILITY_BY_ID.get(target);
      if (!capability) return false;
      inspectorTarget = target;
      inspectorBranch = capability.branch;
      targetByBranch[inspectorBranch] = target;
      editor.dataset.inspectorBranch = inspectorBranch;
      editor.dataset.inspectorTarget = inspectorTarget;
      launcherPreview?.setAttribute(
        "aria-pressed", String(inspectorTarget === "widgets.app-identity"),
      );
      for (const tab of branchTabs) {
        const selected = tab.dataset.editorBranchTarget === inspectorBranch;
        tab.setAttribute("aria-pressed", String(selected));
        tab.tabIndex = selected ? 0 : -1;
        if (selected && focusBranch) tab.focus();
      }
      syncTargetPicker();
      refreshInspectorContext();
      syncStageSelectionMode();
      if (reveal) requestAnimationFrame(() => {
        const firstSection = editor.querySelector(
          `[data-editor-targets~="${CSS.escape(target)}"]:not([hidden])`,
        );
        if (!firstSection || !editorControls || !inspectorHead) return;
        const visibleTop = inspectorHead.getBoundingClientRect().bottom + 12;
        const sectionTop = firstSection.getBoundingClientRect().top;
        if (sectionTop < visibleTop) editorControls.scrollTop += sectionTop - visibleTop;
      });
      return true;
    };
    setInspectorTarget(inspectorTarget);
    const reflectStageSelectionForTarget = (target) => {
      if (target === "interface.new-chat-area") {
        stageSelection = { kind: "prompt" };
      } else if (target === "background.layer" && selectedLayerId) {
        stageSelection = { kind: "layer", id: selectedLayerId };
      } else {
        stageSelection = null;
      }
      syncStageHud();
    };
    branchTabs.forEach((tab) => tab.addEventListener("click", () => {
      const branch = tab.dataset.editorBranchTarget;
      const target = targetByBranch[branch];
      if (!target) return;
      setInspectorTarget(target, { reveal: true });
      reflectStageSelectionForTarget(target);
      renderStage();
    }));
    branchTabs.forEach((tab, index) => tab.addEventListener("keydown", (event) => {
      const previous = event.key === "ArrowLeft" || event.key === "ArrowUp";
      const next = event.key === "ArrowRight" || event.key === "ArrowDown";
      const boundary = event.key === "Home" || event.key === "End";
      if (!previous && !next && !boundary) return;
      event.preventDefault();
      const nextIndex = event.key === "Home" ? 0
        : event.key === "End" ? branchTabs.length - 1
          : (index + (previous ? -1 : 1) + branchTabs.length) % branchTabs.length;
      branchTabs[nextIndex].focus();
      branchTabs[nextIndex].click();
    }));
    targetPicker.addEventListener("change", () => {
      const target = targetPicker.value;
      if (!CAPABILITY_BY_ID.has(target)) {
        syncTargetPicker();
        return;
      }
      if (target === "background.layer" && !selectedLayerId) {
        selectedLayerId = state?.layers?.[0]?.id ?? null;
      }
      setInspectorTarget(target, { reveal: true });
      reflectStageSelectionForTarget(target);
      renderStage();
    });
    launcherPreview?.addEventListener("click", () => {
      if (inspectorBranch !== "widgets") return;
      stageSelection = null;
      setInspectorTarget("widgets.app-identity", { reveal: true });
      syncStageHud();
      announce(format(tr("stageSelectedAnnounce"), targetLabel("widgets.app-identity")));
    });

    const resetStudioViewport = (hash) => {
      try {
        if (window.location.hash !== hash) history.replaceState(null, "", hash);
      } catch {}
      // A rail fragment may have moved WebView's root scrolling element even
      // though the visible document owns a nested scroller.
      window.scrollTo(0, 0);
      content.scrollTop = 0;
    };

    const showEditor = () => {
      for (const section of ordinarySections) section.hidden = true;
      editor.hidden = false;
      if (studioShell) studioShell.dataset.editorActive = "true";
      setCurrentNavigation(true);
      if (firstOpen) {
        resetStudioViewport("#editor");
        if (stageColumn) stageColumn.scrollTop = 0;
        if (editorControls) editorControls.scrollTop = 0;
        requestAnimationFrame(() => {
          resetStudioViewport("#editor");
          title.focus();
          applyStageLayout();
        });
        firstOpen = false;
      }
    };

    const hideEditor = (action = "") => {
      editor.hidden = true;
      studioShell?.removeAttribute("data-editor-active");
      for (const section of ordinarySections) section.hidden = false;
      setCurrentNavigation(false);
      resetStudioViewport("#themes");
      firstOpen = true;
      dropStageWork();
      stageSelection = null;
      selectedLayerId = null;
      renderedLayerSignature = null;
      stageHiddenLayers.clear();
      stageLayersUserToggled = false;
      setStageLayersCollapsed(true);
      targetByBranch.interface = "interface.theme";
      targetByBranch.background = "background.canvas";
      targetByBranch.widgets = "widgets.app-identity";
      setInspectorTarget("interface.theme");
      documentDetails.open = false;
      stageMirror = null;
      stageLiveMirror = null;
      stageMirrorCache.clear();
      stageMirrorCacheBasis = null;
      stageContextTouched = false;
      previewSizeEditing = false;
      previewSizeIntent = null;
      previewExpectedRequest = null;
      stageContext = "new-chat";
      stageBackdropImg.removeAttribute("src");
      stageBackdropImg.hidden = true;
      if (mirrorCaption) mirrorCaption.textContent = tr("mirrorEmpty");
      if (backdropToggleInput) {
        backdropToggleInput.checked = true;
        backdropToggleInput.disabled = true;
      }
      if (topmostEnabled) {
        send({ type: "set-aura-topmost", enabled: false });
        topmostEnabled = false;
        topmostButton?.setAttribute("aria-pressed", "false");
      }
      if (appearanceTouched && entryAppearance) {
        send({ type: "set-appearance", appearance: entryAppearance });
      }
      appearanceTouched = false;
      const focusId = action === "delete-user-theme" ? "default" : returnTheme;
      requestAnimationFrame(() => focusThemeCard?.(focusId));
    };

    function showConfirm({ titleText, bodyText, actionText, destructive = false, opener, callback }) {
      confirmTitle.textContent = titleText;
      confirmBody.textContent = bodyText;
      confirmAction.textContent = actionText;
      confirmAction.dataset.destructive = String(destructive);
      confirmCallback = callback;
      confirmReturnFocus = opener;
      confirmDialog.showModal();
      requestAnimationFrame(() => confirmAction.focus());
    }

    confirmAction.addEventListener("click", () => {
      const callback = confirmCallback;
      confirmCallback = null;
      confirmDialog.close("confirmed");
      callback?.();
    });
    confirmDialog.addEventListener("close", () => {
      if (confirmDialog.returnValue !== "confirmed") confirmReturnFocus?.focus();
      confirmCallback = null;
      confirmReturnFocus = null;
    });

    // ── Live framing stage ─────────────────────────────────────────────
    // A schematic canvas (labelled "not a Claude preview") that renders the
    // draft's real tokens and artwork with the renderer's framing math and
    // lets users drag or arrow-key items. Local echo is instant; commits go
    // through the same validated bridge actions, queued one at a time.
    const stagePanel = stageRoot?.closest(".stage-panel");
    const editorHeader = editor.querySelector(".editor-header");
    const stageViewportInputs = [...document.querySelectorAll('input[name="stage-viewport"]')];
    const stageContextInputs = [...document.querySelectorAll('input[name="stage-context"]')];
    const stageZonesInput = document.getElementById("stage-zones");
    let stageDrag = null;
    let stageKeyTimer = null;
    const stageKeyPaths = new Set();
    let stageMirror = null;
    let stageLiveMirror = null;
    const stageMirrorCache = new Map();
    let stageMirrorCacheBasis = null;
    let stageContextTouched = false;
    let previewResizeTimer = null;
    let previewSizeEditing = false;
    let previewRequestSerial = 0;
    let previewExpectedRequest = null;
    // Drag pointermove is coalesced into one animation frame so a 120 Hz
    // pointer stream produces at most one layout pass per displayed frame.
    let stageDragFrame = 0;
    let stageDragEvent = null;
    const stageOverrides = new Map();
    const stageLayerNodes = new Map();
    // Memoized lookups of the range inputs mirrored during a drag; nodes are
    // re-resolved automatically once a layer-card rebuild disconnects them.
    const stageInputCache = new Map();
    const layerIndexForId = (id) => state?.layers.findIndex((layer) => layer.id === id) ?? -1;
    const layerForId = (id) => state?.layers.find((layer) => layer.id === id) ?? null;
    const clampNumber = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));
    const backdropToggleInput = document.getElementById("stage-backdrop");
    const openAuraButton = document.getElementById("stage-open-aura");
    // With a live capture as backdrop, the stage adopts the real window's
    // exact dimensions so drags map 1:1 onto the real pixels. When the user
    // edits a page context the real window is not showing, that view falls
    // back to the schematic so the toggle always produces a visible change.
    const hasUsableMirrorGeometry = (mirror) => {
      const geometry = mirror?.geometry;
      return Boolean(["new-chat", "conversation"].includes(geometry?.context)
        && ["light", "dark"].includes(geometry?.mode)
        && ["normal", "wide"].includes(geometry?.viewport)
        && clampedMirrorMainMetrics(geometry?.main, mirror?.width, mirror?.height));
    };
    const stageBackdropOn = () => {
      const geometry = stageMirror?.geometry;
      return Boolean(backdropToggleInput?.checked
        && stageMirror?.revision === state?.revision
        && stageMirror?.width === stagePreviewSize[0]
        && stageMirror?.height === stagePreviewSize[1]
        && geometry?.context === stageContext
        && geometry.mode === selectedMode
        && geometry.viewport === stageViewport
        && hasUsableMirrorGeometry(stageMirror));
    };
    const stageLogicalSize = () => stageBackdropOn()
      ? [stageMirror.width, stageMirror.height]
      : stagePreviewSize;
    const stageMainMetrics = (logicalWidth, logicalHeight) => {
      const geometryMain = stageBackdropOn() ? stageMirror?.geometry?.main : null;
      const measured = clampedMirrorMainMetrics(geometryMain, logicalWidth, logicalHeight);
      if (measured) return measured;
      return { left: STAGE_SIDEBAR_WIDTH, width: logicalWidth - STAGE_SIDEBAR_WIDTH, height: logicalHeight };
    };

    // Path strings are drawn from a small fixed vocabulary, so parsing each into
    // segments once and reusing them spares a regex + split on every read — and
    // a single layout pass reads dozens of paths.
    const pathSegments = new Map();
    const segmentsFor = (path) => {
      let segments = pathSegments.get(path);
      if (!segments) {
        segments = path.replace(/\[(\d+)]/g, ".$1").split(".");
        pathSegments.set(path, segments);
      }
      return segments;
    };
    const statePath = (path) => {
      let node = state;
      for (const part of segmentsFor(path)) {
        if (node == null) return undefined;
        node = node[part];
      }
      return node;
    };
    const roundPromptRatio = (value) => Math.round(value * 10000) / 10000;
    const measuredNativePrompt = () => {
      const fallback = state?.shared?.prompt ?? { width: 0.76, x: 0, y: 0 };
      if (!fallback.native) return { width: fallback.width, x: fallback.x, y: fallback.y };
      const mirror = stageMirror;
      const geometry = mirror?.geometry;
      const main = geometry?.main;
      const prompt = geometry?.prompt;
      const matches = mirror?.revision === state?.revision
        && mirror?.width === stagePreviewSize[0]
        && mirror?.height === stagePreviewSize[1]
        && geometry?.context === "new-chat"
        && geometry?.mode === selectedMode;
      if (!matches || !main || !prompt || prompt.width <= 40) {
        return { width: fallback.width, x: fallback.x, y: fallback.y };
      }
      const mainMetrics = clampedMirrorMainMetrics(main, mirror.width, mirror.height);
      if (!mainMetrics) {
        return { width: fallback.width, x: fallback.x, y: fallback.y };
      }
      return {
        width: roundPromptRatio(clampNumber(prompt.width / mainMetrics.width, 0.4, 0.96)),
        x: roundPromptRatio(clampNumber(
          ((prompt.left + (prompt.width / 2)) - (mainMetrics.left + (mainMetrics.width / 2))) / mainMetrics.width,
          -0.35,
          0.35,
        )),
        // Renderer offsets are relative to Claude's native vertical position.
        y: 0,
      };
    };
    const promptStateValue = (key) => state?.shared?.prompt?.native
      ? measuredNativePrompt()[key]
      : statePath(`shared.prompt.${key}`);
    const stageValue = (path) => {
      if (stageOverrides.has(path)) return stageOverrides.get(path);
      const prompt = /^shared\.prompt\.(width|x|y)$/.exec(path);
      return prompt ? promptStateValue(prompt[1]) : statePath(path);
    };
    const setStageOverride = (path, value) => { if (path) stageOverrides.set(path, value); };
    const seedNativePromptOverrides = () => {
      if (!state?.shared?.prompt?.native) return;
      const seed = measuredNativePrompt();
      for (const key of ["width", "x", "y"]) {
        const path = `shared.prompt.${key}`;
        if (!stageOverrides.has(path)) setStageOverride(path, seed[key]);
      }
    };
    const dropStageWork = () => {
      coalescedChanges.clear();
      deferredChanges.clear();
      clearInFlightChanges();
      if (changeFlushTimer) { clearTimeout(changeFlushTimer); changeFlushTimer = null; }
      stageOverrides.clear();
      stageDrag = null;
      stageDragEvent = null;
      if (stageDragFrame) { cancelAnimationFrame(stageDragFrame); stageDragFrame = 0; }
      if (stageKeyTimer) { clearTimeout(stageKeyTimer); stageKeyTimer = null; }
      stageKeyPaths.clear();
      actionAfterPatch = null;
      if (previewResizeTimer) { clearTimeout(previewResizeTimer); previewResizeTimer = null; }
    };

    const queueStageMutations = (messages) => {
      const changes = messages.map((message) => message.type === "set-theme-layer"
        ? {
          kind: "layer", layerId: state?.layers?.[message.index]?.id, preset: message.preset,
          property: message.property, value: message.value,
        }
        : {
          kind: "token", mode: message.mode, token: message.token, value: message.value,
        }).filter((change) => change.kind !== "layer" || change.layerId);
      queueThemeChanges(changes, { immediate: true });
    };

    const messageForStagePath = (path, value) => {
      const layer = /^layers\[(\d+)]\.frames\.(normal|wide)\.(positionX|positionY|scale)$/.exec(path);
      if (layer) {
        const rounded = layer[3] === "scale"
          ? Math.round(value * 10000) / 10000
          : Math.round(value * 100) / 100;
        return { type: "set-theme-layer", index: Number(layer[1]), preset: layer[2], property: layer[3], value: rounded };
      }
      const prompt = /^shared\.prompt\.(width|x|y)$/.exec(path);
      if (prompt) {
        return {
          type: "set-theme-token",
          mode: "shared",
          token: STAGE_PROMPT_TOKENS[prompt[1]],
          value: roundPromptRatio(value),
        };
      }
      return null;
    };
    const stageItemPaths = (selection) => {
      if (!selection) return [];
      if (selection.kind === "prompt") return [...STAGE_PROMPT_PATHS];
      const index = layerIndexForId(selection.id);
      return index < 0 ? [] : STAGE_LAYER_PATHS.map((property) => `layers[${index}].frames.${stageViewport}.${property}`);
    };
    const commitStagePaths = (paths) => {
      const messages = [];
      const adoptsNativePrompt = Boolean(state?.shared?.prompt?.native
        && STAGE_PROMPT_PATHS.some((path) => paths.includes(path) && stageOverrides.has(path)
          && Math.abs(Number(stageOverrides.get(path)) - Number(promptStateValue(path.split(".").at(-1)))) >= 0.00005));
      for (const path of paths) {
        if (!stageOverrides.has(path)) continue;
        const value = stageOverrides.get(path);
        const promptKey = /^shared\.prompt\.(width|x|y)$/.exec(path)?.[1];
        const saved = promptKey ? promptStateValue(promptKey) : statePath(path);
        if (!(adoptsNativePrompt && promptKey)
            && typeof value === "number" && typeof saved === "number" && Math.abs(value - saved) < 0.00005) continue;
        const message = messageForStagePath(path, value);
        if (message) messages.push(message);
      }
      if (messages.length) queueStageMutations(messages);
    };
    const flushStageKeyChanges = () => {
      if (stageKeyTimer) clearTimeout(stageKeyTimer);
      stageKeyTimer = null;
      const paths = [...stageKeyPaths];
      stageKeyPaths.clear();
      if (paths.length) commitStagePaths(paths);
      reflectButtonStates();
    };

    const stageFrame = document.createElement("div");
    stageFrame.className = "stage-frame";
    const stageCanvas = document.createElement("div");
    stageCanvas.className = "stage-canvas";
    const stageBackdropImg = document.createElement("img");
    stageBackdropImg.className = "stage-backdrop";
    stageBackdropImg.alt = "";
    stageBackdropImg.setAttribute("aria-hidden", "true");
    stageBackdropImg.setAttribute("draggable", "false");
    stageBackdropImg.hidden = true;
    const stageArt = document.createElement("div");
    stageArt.className = "stage-art";
    const stageSidebarEl = document.createElement("div");
    stageSidebarEl.className = "stage-sidebar";
    const stageContentHost = document.createElement("div");
    stageContentHost.className = "stage-content-host";
    const stageZonesHost = document.createElement("div");
    stageZonesHost.className = "stage-zones";
    stageZonesHost.setAttribute("aria-hidden", "true");
    const stageZone = (className, key) => {
      const node = document.createElement("span");
      node.className = `stage-zone ${className}`;
      node.dataset.editorI18n = key;
      node.textContent = tr(key);
      return node;
    };
    stageZonesHost.append(
      stageZone("stage-zone-sidebar", "sidebarZone"),
      stageZone("stage-zone-text", "textSafeZone"),
      stageZone("stage-zone-edge", "edgeCropZone"),
      stageZone("stage-zone-composer", "composerReserve"),
    );
    const stageHud = document.createElement("div");
    stageHud.className = "stage-hud";
    const stageRing = document.createElement("div");
    stageRing.className = "stage-hud-ring";
    // The ring is a pointer-only move surface for the current selection. It
    // sits above overlapping artwork, so an interior drag keeps the layer the
    // user chose in the palette instead of retargeting the topmost image.
    // Focusable edge handles remain the equivalent keyboard controls.
    stageRing.dataset.stageHandle = "move";
    stageRing.setAttribute("aria-hidden", "true");
    stageRing.hidden = true;
    stageHud.appendChild(stageRing);
    // Selection chrome: edge bars move the item, corner handles resize it,
    // and an opacity slider rides the selection border.
    const stageEdges = ["n", "e", "s", "w"].map((side) => {
      const node = document.createElement("div");
      node.className = "stage-edge";
      node.dataset.stageHandle = "move";
      node.dataset.side = side;
      node.setAttribute("role", "slider");
      node.tabIndex = 0;
      node.hidden = true;
      stageHud.appendChild(node);
      return node;
    });
    const stageCorners = ["nw", "ne", "sw", "se"].map((corner) => {
      const node = document.createElement("div");
      node.className = "stage-corner";
      node.dataset.stageHandle = "scale";
      node.dataset.corner = corner;
      node.setAttribute("role", "slider");
      node.tabIndex = 0;
      node.hidden = true;
      stageHud.appendChild(node);
      return node;
    });
    const stageOpacityWrap = document.createElement("div");
    stageOpacityWrap.className = "stage-opacity";
    stageOpacityWrap.hidden = true;
    const stageOpacityInput = document.createElement("input");
    stageOpacityInput.type = "range";
    stageOpacityInput.min = "0";
    stageOpacityInput.max = "100";
    stageOpacityInput.step = "1";
    stageOpacityWrap.appendChild(stageOpacityInput);
    stageHud.appendChild(stageOpacityWrap);
    stageOpacityInput.addEventListener("input", () => {
      if (isBlockingAction() || stageSelection?.kind !== "layer") return;
      const index = layerIndexForId(stageSelection.id);
      if (index < 0) return;
      setStageOverride(`layers[${index}].opacity`, stageOpacityInput.valueAsNumber / 100);
      applyStageLayout();
    });
    stageOpacityInput.addEventListener("change", () => {
      if (isBlockingAction() || stageSelection?.kind !== "layer") return;
      const index = layerIndexForId(stageSelection.id);
      if (index < 0) return;
      queueStageMutations([{
        type: "set-theme-layer",
        index,
        preset: "shared",
        property: "opacity",
        value: stageOpacityInput.valueAsNumber / 100,
      }]);
    });
    // The collapsed canvas palette is a fast selector only. Its visibility
    // buttons are session-local; persistent image settings stay in the
    // inspector so the canvas does not duplicate commands.
    const stageLayersPanel = document.createElement("div");
    stageLayersPanel.className = "stage-layers-panel";
    stageLayersPanel.setAttribute("role", "group");
    stageLayersPanel.dataset.editorI18nAriaLabel = "stageLayersPanel";
    stageLayersPanel.setAttribute("aria-label", "Layers");
    stageLayersPanel.dataset.collapsed = "true";
    const stageLayersHead = document.createElement("button");
    stageLayersHead.type = "button";
    stageLayersHead.className = "stage-layers-head";
    stageLayersHead.setAttribute("aria-expanded", "false");
    const stageLayersList = document.createElement("div");
    stageLayersList.className = "stage-layers-list";
    stageLayersPanel.append(stageLayersHead, stageLayersList);
    let stageLayersUserToggled = false;
    const setStageLayersCollapsed = (collapsed) => {
      stageLayersPanel.dataset.collapsed = String(collapsed);
      stageLayersHead.setAttribute("aria-expanded", String(!collapsed));
    };
    stageLayersHead.addEventListener("click", () => {
      const collapsed = stageLayersPanel.dataset.collapsed === "true";
      stageLayersUserToggled = true;
      setStageLayersCollapsed(!collapsed);
    });
    const stageHiddenLayers = new Set();
    const stageEmptyNote = document.createElement("p");
    stageEmptyNote.className = "stage-empty";
    stageEmptyNote.hidden = true;
    const stagePromptEl = document.createElement("div");
    stagePromptEl.className = "stage-prompt";
    stagePromptEl.dataset.stageItem = "prompt";
    stagePromptEl.dataset.editorFocus = "stage-prompt";
    stagePromptEl.setAttribute("role", "button");
    stagePromptEl.setAttribute("aria-label", tr("stagePromptAria"));
    stagePromptEl.setAttribute("aria-pressed", "false");
    stagePromptEl.tabIndex = 0;
    const stagePromptSample = document.createElement("span");
    stagePromptSample.className = "stage-prompt-sample";
    stagePromptSample.setAttribute("aria-hidden", "true");
    stagePromptSample.textContent = "Aa";
    const stagePromptChip = document.createElement("span");
    stagePromptChip.className = "stage-prompt-chip";
    stagePromptChip.dataset.editorI18n = "stagePromptTag";
    stagePromptChip.textContent = tr("stagePromptTag");
    stagePromptEl.append(stagePromptSample, stagePromptChip);
    const stageStripA = document.createElement("div");
    stageStripA.className = "stage-strip";
    const stageStripB = document.createElement("div");
    stageStripB.className = "stage-strip stage-strip-alt";
    const stageComposerEl = document.createElement("div");
    stageComposerEl.className = "stage-composer";
    stageCanvas.append(stageBackdropImg, stageArt, stageSidebarEl, stageContentHost, stageZonesHost);
    stageFrame.append(stageCanvas, stageHud, stageEmptyNote, stageLayersPanel);
    stageRoot.appendChild(stageFrame);
    const stageContextHint = document.createElement("p");
    stageContextHint.className = "help stage-context-hint";
    stageContextHint.textContent = format(tr("stageContextMismatch"), tr("stageNewChat"));
    stageContextHint.hidden = true;
    stageRoot.appendChild(stageContextHint);
    stageRoot.dataset.zones = "false";

    const stageLayerGate = (layer) => {
      const read = (property) => stageValue(`layers[${layer.index}].${property}`);
      const appearance = read("appearance");
      const context = read("context");
      const viewport = read("viewport");
      return read("visible") !== false
        && (appearance === "all" || appearance === selectedMode)
        && (context === "all" || context === stageContext)
        && (viewport === "all" || viewport === stageViewport);
    };
    const stageContextLabel = (context = stageContext) => tr(
      context === "conversation" ? "stageConversation" : "stageNewChat",
    );

    const syncStageToolbar = () => {
      for (const input of stageViewportInputs) input.checked = input.value === stageViewport;
      for (const input of stageContextInputs) input.checked = input.value === stageContext;
      if (stageZonesInput) stageRoot.dataset.zones = String(stageZonesInput.checked);
      const newChat = stageContext === "new-chat";
      if (promptContextSection) {
        promptContextSection.hidden = !newChat;
        promptContextSection.inert = !newChat;
      }
      if (promptContextUnavailable) promptContextUnavailable.hidden = newChat;
      refreshInspectorContext();
      syncStageSelectionMode();
    };

    const renderStageLayersPanel = () => {
      if (!state) return;
      stageLayersHead.textContent = `${tr("stageLayersPanel")} · ${state.layers.length}`;
      stageLayersList.replaceChildren();
      for (const layer of state.layers) {
        const gated = !stageLayerGate(layer);
        const chip = document.createElement("div");
        chip.className = "stage-chip";
        chip.dataset.layerId = layer.id;
        chip.dataset.active = String(stageSelection?.kind === "layer" && stageSelection.id === layer.id);
        chip.dataset.stageHidden = String(stageHiddenLayers.has(layer.id));
        chip.dataset.gated = String(gated);
        const select = document.createElement("button");
        select.type = "button";
        select.className = "stage-chip-select";
        select.dataset.editorFocus = `stage-chip-${layer.id}`;
        select.setAttribute("aria-label", format(tr("stageSelectLayer"), layer.index + 1));
        select.disabled = gated;
        const thumb = document.createElement("span");
        thumb.className = "stage-chip-thumb";
        thumb.setAttribute("aria-hidden", "true");
        if (layer.previewUrl) {
          const image = document.createElement("img");
          image.src = layer.previewUrl;
          image.alt = "";
          image.setAttribute("draggable", "false");
          thumb.appendChild(image);
        } else thumb.textContent = String(layer.index + 1);
        const text = document.createElement("span");
        text.className = "stage-chip-label";
        const currentRole = String(stageValue(`layers[${layer.index}].role`) ?? layer.role);
        text.textContent = `${layer.index + 1} · ${tr(`role${currentRole[0].toUpperCase()}${currentRole.slice(1)}`)}`;
        select.append(thumb, text);
        select.addEventListener("click", () => {
          stageHiddenLayers.delete(layer.id);
          selectStageItem({ kind: "layer", id: layer.id }, { reveal: true });
          renderStage();
        });
        const eye = document.createElement("button");
        eye.type = "button";
        eye.className = "stage-eye";
        eye.dataset.editorFocus = `stage-eye-${layer.id}`;
        eye.setAttribute("aria-pressed", String(!stageHiddenLayers.has(layer.id)));
        eye.setAttribute("aria-label", format(tr("stageEyeToggle"), layer.index + 1, tr(`role${currentRole[0].toUpperCase()}${currentRole.slice(1)}`)));
        eye.textContent = tr(stageHiddenLayers.has(layer.id) ? "stageEyeShowShort" : "stageEyeHideShort");
        eye.disabled = gated;
        eye.addEventListener("click", () => {
          if (stageHiddenLayers.has(layer.id)) stageHiddenLayers.delete(layer.id);
          else {
            stageHiddenLayers.add(layer.id);
            if (stageSelection?.kind === "layer" && stageSelection.id === layer.id) stageSelection = null;
          }
          renderStage();
        });
        chip.append(select, eye);
        stageLayersList.appendChild(chip);
      }
    };

    const ensureStageStructure = () => {
      if (!state) return;
      const focused = document.activeElement?.dataset?.editorFocus ?? null;
      for (const id of [...stageHiddenLayers]) {
        if (!layerForId(id)) stageHiddenLayers.delete(id);
      }
      const seen = new Set();
      let previous = null;
      for (const layer of state.layers) {
        if (stageHiddenLayers.has(layer.id) || !stageLayerGate(layer)) continue;
        seen.add(layer.id);
        let entry = stageLayerNodes.get(layer.id);
        if (entry && entry.previewUrl !== layer.previewUrl) {
          entry.wrap.remove();
          stageLayerNodes.delete(layer.id);
          entry = null;
        }
        if (!entry) {
          const wrap = document.createElement("div");
          wrap.className = "stage-layer";
          let item;
          if (layer.previewUrl) {
            item = document.createElement("img");
            item.src = layer.previewUrl;
            item.alt = "";
            item.setAttribute("draggable", "false");
          } else {
            item = document.createElement("div");
            item.className = "stage-layer-fallback";
            item.textContent = tr("noImagePreview");
          }
          item.classList.add("stage-item");
          item.dataset.stageItem = layer.id;
          item.dataset.editorFocus = `stage-layer-${layer.id}`;
          item.setAttribute("role", "button");
          item.setAttribute("aria-pressed", "false");
          item.tabIndex = 0;
          wrap.appendChild(item);
          entry = { wrap, item, previewUrl: layer.previewUrl };
          stageLayerNodes.set(layer.id, entry);
        }
        const currentRole = String(stageValue(`layers[${layer.index}].role`) ?? layer.role);
        const roleLabel = tr(`role${currentRole[0].toUpperCase()}${currentRole.slice(1)}`);
        entry.item.setAttribute("aria-label", format(tr("stageLayerAria"), layer.index + 1, roleLabel));
        if (previous) previous.after(entry.wrap);
        else stageArt.prepend(entry.wrap);
        previous = entry.wrap;
      }
      for (const [id, entry] of [...stageLayerNodes]) {
        if (!seen.has(id)) {
          entry.wrap.remove();
          stageLayerNodes.delete(id);
        }
      }
      stageContentHost.replaceChildren(...(stageContext === "new-chat"
        ? [stagePromptEl]
        : [stageStripA, stageStripB, stageComposerEl]));
      stageEmptyNote.textContent = tr("stageEmpty");
      stageEmptyNote.hidden = inspectorBranch !== "background" || seen.size > 0;
      if (stageSelection?.kind === "layer" && !seen.has(stageSelection.id)) stageSelection = null;
      renderStageLayersPanel();
      syncStageSelectionMode();
      if (focused && !document.activeElement?.dataset?.editorFocus) {
        stageRoot.querySelector(`[data-editor-focus="${focused}"]`)?.focus();
      }
      syncStageToolbar();
    };

    const syncStageHud = () => {
      if (!stageSelectionAllowed(stageSelection)) stageSelection = null;
      stagePromptEl.setAttribute("aria-pressed", String(stageSelection?.kind === "prompt"));
      for (const [id, entry] of stageLayerNodes) {
        entry.item.setAttribute("aria-pressed",
          String(stageSelection?.kind === "layer" && stageSelection.id === id));
      }
      let target = null;
      if (stageSelection?.kind === "layer") target = stageLayerNodes.get(stageSelection.id)?.item ?? null;
      else if (stageSelection?.kind === "prompt" && stageContext === "new-chat") target = stagePromptEl;
      const chrome = [...stageEdges, ...stageCorners];
      if (!target || !state) {
        stageRing.hidden = true;
        stageOpacityWrap.hidden = true;
        for (const node of chrome) node.hidden = true;
        return;
      }
      const frameRect = stageFrame.getBoundingClientRect();
      const rect = target.getBoundingClientRect();
      const left = rect.left - frameRect.left;
      const top = rect.top - frameRect.top;
      const clampX = (value, size) => clampNumber(value, 2, Math.max(2, frameRect.width - size - 2));
      const clampY = (value, size) => clampNumber(value, 2, Math.max(2, frameRect.height - size - 2));
      stageRing.hidden = false;
      stageRing.style.left = `${left}px`;
      stageRing.style.top = `${top}px`;
      stageRing.style.width = `${rect.width}px`;
      stageRing.style.height = `${rect.height}px`;
      const prompt = stageSelection.kind === "prompt";
      const setRect = (node, x, y, width, height) => {
        node.hidden = false;
        node.style.left = `${x}px`;
        node.style.top = `${y}px`;
        node.style.width = `${width}px`;
        node.style.height = `${height}px`;
      };
      const barLength = Math.max(12, rect.width - 24);
      const sideLength = Math.max(12, rect.height - 24);
      setRect(stageEdges[0], clampX(left + 12, barLength), clampY(top - 4, 8), barLength, 8);
      setRect(stageEdges[1], clampX(left + rect.width - 4, 8), clampY(top + 12, sideLength), 8, sideLength);
      setRect(stageEdges[2], clampX(left + 12, barLength), clampY(top + rect.height - 4, 8), barLength, 8);
      setRect(stageEdges[3], clampX(left - 4, 8), clampY(top + 12, sideLength), 8, sideLength);
      const selectionIndex = stageSelection.kind === "layer" ? layerIndexForId(stageSelection.id) : -1;
      const framePrefix = selectionIndex >= 0 ? `layers[${selectionIndex}].frames.${stageViewport}.` : "";
      const positionX = Number(stageSelection.kind === "prompt"
        ? stageValue("shared.prompt.x") * 100
        : stageValue(`${framePrefix}positionX`)) || 0;
      const positionY = Number(stageSelection.kind === "prompt"
        ? stageValue("shared.prompt.y") * 100
        : stageValue(`${framePrefix}positionY`)) || 0;
      for (const node of stageEdges) {
        const horizontal = node.dataset.side === "e" || node.dataset.side === "w";
        const value = horizontal ? positionX : positionY;
        const limit = stageSelection.kind === "prompt" ? (horizontal ? 35 : 30) : 100;
        node.setAttribute("aria-label", tr("stageMoveHandle"));
        node.setAttribute("aria-orientation", horizontal ? "horizontal" : "vertical");
        node.setAttribute("aria-valuemin", String(-limit));
        node.setAttribute("aria-valuemax", String(limit));
        node.setAttribute("aria-valuenow", String(Math.round(value * 100) / 100));
        node.setAttribute("aria-valuetext", `${Math.round(value * 100) / 100}%`);
      }
      const cornerTarget = 24;
      const cornerOffset = cornerTarget / 2;
      const cornerPoints = {
        nw: [left - cornerOffset, top - cornerOffset], ne: [left + rect.width - cornerOffset, top - cornerOffset],
        sw: [left - cornerOffset, top + rect.height - cornerOffset], se: [left + rect.width - cornerOffset, top + rect.height - cornerOffset],
      };
      for (const node of stageCorners) {
        const point = cornerPoints[node.dataset.corner];
        const value = stageSelection.kind === "prompt"
          ? (Number(stageValue("shared.prompt.width")) || 0.4) * 100
          : (Number(stageValue(`${framePrefix}scale`)) || 1) * 100;
        node.hidden = false;
        node.style.left = `${clampX(point[0], cornerTarget)}px`;
        node.style.top = `${clampY(point[1], cornerTarget)}px`;
        node.setAttribute("aria-label", tr(prompt ? "stageWidthHandle" : "stageScaleHandle"));
        node.setAttribute("aria-valuemin", prompt ? "40" : "25");
        node.setAttribute("aria-valuemax", prompt ? "96" : "300");
        node.setAttribute("aria-valuenow", String(Math.round(value * 100) / 100));
        node.setAttribute("aria-valuetext", `${Math.round(value * 100) / 100}%`);
      }
      if (prompt) {
        stageOpacityWrap.hidden = true;
      } else {
        const index = layerIndexForId(stageSelection.id);
        const opacity = Number(index < 0 ? 1 : stageValue(`layers[${index}].opacity`));
        stageOpacityInput.value = String(Math.round((Number.isFinite(opacity) ? opacity : 1) * 100));
        stageOpacityInput.setAttribute("aria-label", tr("layerOpacity"));
        stageOpacityWrap.hidden = false;
        let wrapTop = top + rect.height + 10;
        if (wrapTop + 34 > frameRect.height) wrapTop = top + rect.height - 42;
        stageOpacityWrap.style.left = `${clampX(left + 6, 110)}px`;
        stageOpacityWrap.style.top = `${clampY(wrapTop, 30)}px`;
      }
    };

    const applyStageLayout = () => {
      if (!state) return;
      const captureActive = stageBackdropOn();
      const [logicalWidth, logicalHeight] = stageLogicalSize();
      const stageHostWidth = stageRoot.clientWidth;
      const currentFrameHeight = stageFrame.offsetHeight;
      const panelChromeHeight = Math.max(110,
        (stagePanel?.offsetHeight ?? (currentFrameHeight + 110)) - currentFrameHeight);
      const paneHeight = stageColumn?.clientHeight ?? 0;
      const viewportHeight = content?.clientHeight || window.innerHeight || logicalHeight;
      const entryOffset = (editorHeader?.offsetHeight ?? 0) + 22;
      const availableFrameHeight = Math.max(120, paneHeight > 0
        ? paneHeight - panelChromeHeight - 16
        : viewportHeight - entryOffset - panelChromeHeight - 16);
      const scale = stageHostWidth > 0
        ? Math.min(1, stageHostWidth / logicalWidth, availableFrameHeight / logicalHeight)
        : 0;
      const frameWidth = scale ? Math.round(logicalWidth * scale) : 0;
      const frameHeight = scale ? Math.round(logicalHeight * scale) : 0;
      stageFrame.style.width = frameWidth ? `${frameWidth}px` : "";
      stageFrame.style.height = frameHeight ? `${frameHeight}px` : "";
      if (frameWidth) {
        const compactLayers = frameWidth < 720 || frameHeight < 360;
        if (compactLayers || !stageLayersUserToggled) setStageLayersCollapsed(true);
      }
      stageFrame.dataset.backdrop = captureActive ? "capture" : "schematic";
      stageFrame.dataset.captureState = captureActive
        ? (stageMirror === stageLiveMirror ? "live" : "cached")
        : "schematic";
      const missingSelectedCapture = Boolean(backdropToggleInput?.checked && !captureActive);
      stageContextHint.hidden = !missingSelectedCapture;
      if (missingSelectedCapture) {
        stageContextHint.textContent = format(tr("stageContextMismatch"), stageContextLabel());
      }
      if (openAuraButton) {
        const labelKey = missingSelectedCapture ? "stageOpenContext" : "openAuraWindow";
        openAuraButton.dataset.editorI18n = labelKey;
        openAuraButton.textContent = tr(labelKey);
      }
      stageBackdropImg.hidden = !captureActive;
      if (captureActive && stageBackdropImg.src !== stageMirror.image) stageBackdropImg.src = stageMirror.image;
      stageCanvas.style.width = `${logicalWidth}px`;
      stageCanvas.style.height = `${logicalHeight}px`;
      stageCanvas.style.transform = `scale(${scale || 1})`;
      const tokenValue = (key) => stageValue(`tokens.${selectedMode}.${key}`);
      // Over a live capture, an uncommitted colour edit stays invisible until the
      // host re-renders and pushes a fresh capture. While one is pending, dim the
      // capture and let the schematic fills preview the change immediately; it
      // clears itself the moment the override commits and the recapture lands.
      const colorPreview = captureActive && [...stageOverrides.keys()].some((path) =>
        (path.startsWith(`tokens.${selectedMode}.`)
          || path === "shared.radius" || path === "shared.blur" || path === "shared.shadow")
          && String(stageOverrides.get(path)) !== String(statePath(path)));
      stageFrame.dataset.colorPreview = colorPreview ? "true" : "";
      stageSidebarEl.hidden = captureActive && !colorPreview;
      const scope = stageValue("shared.backgroundScope");
      const radius = Number(stageValue("shared.radius")) || 0;
      const blur = Number(stageValue("shared.blur")) || 0;
      const shadow = STAGE_SHADOWS[stageValue("shared.shadow")] ?? "none";
      stageCanvas.style.background = tokenValue("canvas") ?? "#808080";
      const mainMetrics = stageMainMetrics(logicalWidth, logicalHeight);
      stageArt.style.left = scope === "content" ? `${mainMetrics.left}px` : "0";
      const sidebarColor = tokenValue("sidebar") ?? "#808080";
      const sidebarAlpha = Number(tokenValue("sidebarAlpha")) || 1;
      stageSidebarEl.style.width = `${mainMetrics.left}px`;
      stageSidebarEl.style.background = scope === "full-window"
        ? `color-mix(in srgb, ${sidebarColor} ${Math.round(sidebarAlpha * 100)}%, transparent)`
        : sidebarColor;
      stageSidebarEl.style.backdropFilter = scope === "full-window" && blur ? `blur(${Math.min(blur, 32)}px)` : "";
      stageSidebarEl.style.borderRight = `1px solid ${tokenValue("border") ?? "transparent"}`;
      for (const [id, entry] of stageLayerNodes) {
        const index = layerIndexForId(id);
        if (index < 0) continue;
        const framePath = (property) => `layers[${index}].frames.${stageViewport}.${property}`;
        const frameNumber = (property) => Number(stageValue(framePath(property)));
        const anchor = ANCHOR_POINTS[stageValue(framePath("anchor"))] ?? ANCHOR_POINTS.center;
        const opacity = Number(stageValue(`layers[${index}].opacity`));
        entry.wrap.style.opacity = Number.isFinite(opacity) ? String(opacity) : "";
        entry.wrap.dataset.mask = String(stageValue(`layers[${index}].mask`) ?? "none");
        const focalX = frameNumber("focalX") || 0;
        const focalY = frameNumber("focalY") || 0;
        entry.item.style.left = `calc(${anchor[0]}% + ${frameNumber("positionX") || 0}%)`;
        entry.item.style.top = `calc(${anchor[1]}% + ${frameNumber("positionY") || 0}%)`;
        entry.item.style.transform = `translate(${-focalX}%, ${-focalY}%) scale(${frameNumber("scale") || 1})`;
        entry.item.style.transformOrigin = `${focalX}% ${focalY}%`;
      }
      const surface = `color-mix(in srgb, ${tokenValue("surface") ?? "#ffffff"} ${Math.round((Number(tokenValue("surfaceAlpha")) || 1) * 100)}%, transparent)`;
      const mainLeft = STAGE_SIDEBAR_WIDTH;
      const mainWidth = logicalWidth - STAGE_SIDEBAR_WIDTH;
      const applySurface = (node) => {
        node.style.background = surface;
        node.style.border = `1px solid ${tokenValue("border") ?? "transparent"}`;
        node.style.borderRadius = `${radius}px`;
        node.style.boxShadow = shadow;
        node.style.backdropFilter = blur ? `blur(${Math.min(blur, 32)}px)` : "";
      };
      if (stageContext === "new-chat") {
        const realPrompt = captureActive ? stageMirror?.geometry?.prompt : null;
        let rect;
        if (realPrompt && realPrompt.width > 40) {
          // The capture already shows the prompt at the saved draft values, so
          // the outline sits on the real rect and only uncommitted deltas move it.
          const deltaX = ((Number(stageValue("shared.prompt.x")) || 0) - (Number(promptStateValue("x")) || 0)) * mainMetrics.width;
          const deltaY = ((Number(stageValue("shared.prompt.y")) || 0) - (Number(promptStateValue("y")) || 0)) * mainMetrics.height;
          const deltaW = ((Number(stageValue("shared.prompt.width")) || 0) - (Number(promptStateValue("width")) || 0)) * mainMetrics.width;
          rect = {
            left: realPrompt.left + deltaX - (deltaW / 2),
            top: realPrompt.top + deltaY,
            width: Math.max(120, realPrompt.width + deltaW),
            height: realPrompt.height,
          };
        } else {
          rect = promptRect(logicalWidth, logicalHeight,
            Number(stageValue("shared.prompt.width")) || 0.7,
            Number(stageValue("shared.prompt.x")) || 0,
            Number(stageValue("shared.prompt.y")) || 0);
        }
        applySurface(stagePromptEl);
        stagePromptEl.style.left = `${rect.left}px`;
        stagePromptEl.style.top = `${rect.top}px`;
        stagePromptEl.style.width = `${rect.width}px`;
        stagePromptEl.style.height = `${rect.height}px`;
        stagePromptEl.style.color = tokenValue("text") ?? "#000000";
        stagePromptSample.style.fontFamily = STAGE_FONT_STACKS[stageValue("shared.fontDisplay")]
          ?? STAGE_FONT_STACKS["system-sans"];
        stagePromptChip.style.color = tokenValue("accent") ?? "currentColor";
      } else {
        const strips = [[stageStripA, 0.16, 0.13, 0.16, 0.56], [stageStripB, 0.34, 0.17, 0.24, 0.56]];
        for (const [node, topRatio, heightRatio, leftRatio, widthRatio] of strips) {
          applySurface(node);
          node.style.left = `${mainLeft + (mainWidth * leftRatio)}px`;
          node.style.top = `${logicalHeight * topRatio}px`;
          node.style.width = `${mainWidth * widthRatio}px`;
          node.style.height = `${logicalHeight * heightRatio}px`;
        }
        applySurface(stageComposerEl);
        stageComposerEl.style.left = `${mainLeft + (mainWidth * 0.14)}px`;
        stageComposerEl.style.width = `${mainWidth * 0.72}px`;
        stageComposerEl.style.height = "110px";
        stageComposerEl.style.top = `${logicalHeight - 134}px`;
      }
      const zones = stageZonesHost.children;
      const setZoneRect = (node, left, top, width, height) => {
        node.style.left = `${left}px`;
        node.style.top = `${top}px`;
        node.style.width = `${width}px`;
        node.style.height = `${height}px`;
      };
      setZoneRect(zones[0], 0, 0, STAGE_SIDEBAR_WIDTH, logicalHeight);
      setZoneRect(zones[1], mainLeft + (mainWidth * 0.1), logicalHeight * 0.14, mainWidth * 0.62, logicalHeight * 0.5);
      setZoneRect(zones[2], logicalWidth - (mainWidth * 0.18) - 8, logicalHeight * 0.08, mainWidth * 0.18, logicalHeight * 0.6);
      setZoneRect(zones[3], mainLeft + (mainWidth * 0.14), logicalHeight * 0.74, mainWidth * 0.72, logicalHeight * 0.2);
      syncStageHud();
    };

    const renderStage = () => {
      if (!state || stageDrag) return;
      if (!coalescedChanges.size && !deferredChanges.size && !pendingAction
          && !stageKeyTimer && !stageKeyPaths.size) stageOverrides.clear();
      ensureStageStructure();
      applyStageLayout();
      renderStageMatrix();
      updateLayerGateBadges();
    };

    const syncSelectedLayerCards = () => {
      for (const card of layerList.querySelectorAll(".layer-card")) {
        const selected = card.dataset.layerId === selectedLayerId;
        card.dataset.selected = String(selected);
        if (selected) card.open = true;
      }
    };

    const selectStageItem = (selection, { reveal = false } = {}) => {
      if (!stageSelectionAllowed(selection)) return false;
      stageSelection = selection;
      for (const chip of stageLayersPanel.querySelectorAll(".stage-chip")) {
        chip.dataset.active = String(
          selection?.kind === "layer" && chip.dataset.layerId === selection.id,
        );
      }
      if (selection?.kind === "layer") {
        const layer = layerForId(selection.id);
        if (!layer) return;
        selectedLayerId = selection.id;
        if (reveal) {
          const card = layerList.querySelector(`[data-layer-id="${CSS.escape(selection.id)}"]`);
          if (card) card.open = true;
        }
        syncSelectedLayerCards();
        setInspectorTarget("background.layer");
        announce(format(tr("stageSelectedAnnounce"), format(tr("layerNumber"), layer.index + 1)));
      } else if (selection?.kind === "prompt") {
        setInspectorTarget("interface.new-chat-area");
        announce(format(tr("stageSelectedAnnounce"), tr("stagePromptTag")));
      }
      syncStageHud();
      return true;
    };

    const stageSelectionFromNode = (node) => {
      const selection = node.dataset.stageItem === "prompt"
        ? { kind: "prompt" }
        : { kind: "layer", id: node.dataset.stageItem };
      return stageSelectionAllowed(selection) ? selection : null;
    };
    const selectStageBranchSurface = () => {
      const target = inspectorBranch === "interface" ? "interface.theme"
        : inspectorBranch === "background" ? "background.canvas"
          : "widgets.app-identity";
      stageSelection = null;
      setInspectorTarget(target, { reveal: true });
      syncStageHud();
      renderStage();
      announce(format(tr("stageSelectedAnnounce"), targetLabel(target)));
    };

    const stageInputFor = (path) => {
      const cached = stageInputCache.get(path);
      if (cached && cached.isConnected) return cached;
      const input = editor.querySelector(`input[data-editor-field="${CSS.escape(path)}"]`);
      if (input) stageInputCache.set(path, input);
      else stageInputCache.delete(path);
      return input;
    };

    const reflectStageInputs = (paths) => {
      for (const path of paths) {
        if (!stageOverrides.has(path)) continue;
        const value = stageOverrides.get(path);
        const input = stageInputFor(path);
        if (!input || input.type !== "range") continue;
        const prompt = path.startsWith("shared.prompt.");
        input.value = String(prompt ? Math.round(value * 100) : value);
        const exact = input.parentElement?.querySelector(".layer-exact-value, .prompt-exact-value");
        if (exact) exact.value = String(prompt ? Math.round(value * 100) : value);
        const output = prompt
          ? document.getElementById(`${input.id}-output`)
          : input.parentElement?.querySelector("output");
        if (output) {
          output.value = prompt || path.endsWith("scale")
            ? `${Math.round(value * 100)}%`
            : `${Math.round(value)}%`;
        }
      }
    };

    stageRoot.addEventListener("pointerdown", (event) => {
      if (!state || isBlockingAction() || (event.button !== 0 && event.pointerType !== "touch")) return;
      if (event.target.closest?.(".stage-layers-panel, .stage-opacity")) return;
      const handle = event.target.closest?.("[data-stage-handle]");
      const itemNode = event.target.closest?.("[data-stage-item]");
      const directSelection = itemNode ? stageSelectionFromNode(itemNode) : null;
      if (!handle && !directSelection) {
        event.preventDefault();
        selectStageBranchSurface();
        return;
      }
      event.preventDefault();
      let selection = stageSelection;
      if (directSelection) {
        selection = directSelection;
        selectStageItem(selection, { reveal: true });
        itemNode.focus?.();
      }
      if (!selection || !stageSelectionAllowed(selection)) return;
      if (selection.kind === "prompt") seedNativePromptOverrides();
      const [logicalWidth, logicalHeight] = stageLogicalSize();
      const mainMetrics = stageMainMetrics(logicalWidth, logicalHeight);
      const scale = stageFrame.clientWidth > 0 ? stageFrame.clientWidth / logicalWidth : 1;
      if (selection.kind === "layer") stageLayerNodes.get(selection.id)?.wrap.classList.add("is-active");
      const start = {};
      for (const path of stageItemPaths(selection)) start[path] = Number(stageValue(path)) || 0;
      const targetRect = (selection.kind === "layer"
        ? stageLayerNodes.get(selection.id)?.item
        : stagePromptEl)?.getBoundingClientRect();
      const handleKind = handle?.dataset.stageHandle;
      const corner = handle?.dataset.corner ?? "se";
      stageDrag = {
        pointerId: event.pointerId,
        kind: handleKind === "scale"
          ? (selection.kind === "prompt" ? "prompt-width" : "scale")
          : selection.kind === "prompt" ? "prompt-move" : "layer-move",
        signX: corner.includes("w") ? -1 : 1,
        signY: corner.includes("n") ? -1 : 1,
        selection,
        startX: event.clientX,
        startY: event.clientY,
        scale,
        logicalHeight,
        artWidth: stageValue("shared.backgroundScope") === "content"
          ? logicalWidth - mainMetrics.left
          : logicalWidth,
        mainWidth: mainMetrics.width,
        mainHeight: mainMetrics.height,
        start,
        rectSize: Math.max(60, (targetRect?.width ?? 0) + (targetRect?.height ?? 0)),
      };
      try { stageRoot.setPointerCapture(event.pointerId); } catch { /* synthetic pointers have no capture */ }
      stageRoot.classList.add("is-dragging");
    });

    // Turn a pointer sample into overrides. Pure state math, no layout reads —
    // the paint is deferred to the animation frame so bursts of moves collapse.
    const computeStageDragOverrides = (drag, event) => {
      const dx = (event.clientX - drag.startX) / drag.scale;
      const dy = (event.clientY - drag.startY) / drag.scale;
      if (drag.kind === "layer-move") {
        const index = layerIndexForId(drag.selection.id);
        if (index < 0) return;
        const prefix = `layers[${index}].frames.${stageViewport}.`;
        let nextX = clampNumber(drag.start[`${prefix}positionX`] + (dx / drag.artWidth * 100), -100, 100);
        let nextY = clampNumber(drag.start[`${prefix}positionY`] + (dy / drag.logicalHeight * 100), -100, 100);
        if (!event.altKey) {
          // Snap to the anchor point (the layer's aligned default); Alt bypasses.
          if (Math.abs(nextX) < 2.5) nextX = 0;
          if (Math.abs(nextY) < 2.5) nextY = 0;
        }
        setStageOverride(`${prefix}positionX`, nextX);
        setStageOverride(`${prefix}positionY`, nextY);
      } else if (drag.kind === "scale") {
        const index = layerIndexForId(drag.selection.id);
        if (index < 0) return;
        const prefix = `layers[${index}].frames.${stageViewport}.`;
        const factor = 1 + (((drag.signX * (event.clientX - drag.startX)) + (drag.signY * (event.clientY - drag.startY))) / drag.rectSize);
        setStageOverride(`${prefix}scale`, clampNumber(drag.start[`${prefix}scale`] * factor, 0.25, 3));
      } else if (drag.kind === "prompt-move") {
        let nextX = clampNumber(drag.start["shared.prompt.x"] + (dx / drag.mainWidth), -0.35, 0.35);
        let nextY = clampNumber(drag.start["shared.prompt.y"] + (dy / drag.mainHeight), -0.3, 0.3);
        if (!event.altKey) {
          // Snap the prompt block back to its centered default; Alt bypasses.
          if (Math.abs(nextX) < 0.02) nextX = 0;
          if (Math.abs(nextY) < 0.02) nextY = 0;
        }
        stageRoot.dataset.snap = `${nextX === 0 ? "x" : ""}${nextY === 0 ? "y" : ""}`;
        setStageOverride("shared.prompt.x", nextX);
        setStageOverride("shared.prompt.y", nextY);
      } else if (drag.kind === "prompt-width") {
        setStageOverride("shared.prompt.width",
          clampNumber(drag.start["shared.prompt.width"] + (drag.signX * dx * 2 / drag.mainWidth), 0.4, 0.96));
      }
    };

    const runStageDragFrame = () => {
      stageDragFrame = 0;
      const event = stageDragEvent;
      stageDragEvent = null;
      if (!stageDrag || !event) return;
      computeStageDragOverrides(stageDrag, event);
      applyStageLayout();
      reflectStageInputs(stageItemPaths(stageDrag.selection));
    };

    stageRoot.addEventListener("pointermove", (event) => {
      if (!stageDrag || event.pointerId !== stageDrag.pointerId) return;
      stageDragEvent = event;
      if (!stageDragFrame) stageDragFrame = requestAnimationFrame(runStageDragFrame);
    });

    const endStageDrag = (event) => {
      if (!stageDrag || event.pointerId !== stageDrag.pointerId) return;
      // Apply the final buffered sample before committing so the last sliver of
      // movement is not dropped with the cancelled frame.
      if (stageDragFrame) { cancelAnimationFrame(stageDragFrame); stageDragFrame = 0; }
      if (stageDragEvent) { computeStageDragOverrides(stageDrag, stageDragEvent); stageDragEvent = null; }
      try {
        if (stageRoot.hasPointerCapture?.(event.pointerId)) stageRoot.releasePointerCapture(event.pointerId);
      } catch { /* synthetic pointers have no capture */ }
      stageRoot.classList.remove("is-dragging");
      delete stageRoot.dataset.snap;
      for (const active of stageArt.querySelectorAll(".is-active")) active.classList.remove("is-active");
      const drag = stageDrag;
      stageDrag = null;
      commitStagePaths(stageItemPaths(drag.selection));
      renderStage();
    };
    stageRoot.addEventListener("pointerup", endStageDrag);
    stageRoot.addEventListener("pointercancel", endStageDrag);

    stageRoot.addEventListener("keydown", (event) => {
      if (!state || isBlockingAction()) return;
      const handle = event.target.closest?.("[data-stage-handle]");
      const itemNode = event.target.closest?.("[data-stage-item]");
      if (!handle && !itemNode) return;
      const selection = itemNode ? stageSelectionFromNode(itemNode) : stageSelection;
      if (!selection || !stageSelectionAllowed(selection)) return;
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        selectStageItem(selection, { reveal: true });
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        const paths = stageItemPaths(selection);
        for (const path of paths) {
          stageOverrides.delete(path);
          stageKeyPaths.delete(path);
        }
        if (!stageKeyPaths.size && stageKeyTimer) {
          clearTimeout(stageKeyTimer);
          stageKeyTimer = null;
        }
        applyStageLayout();
        reflectStageInputs(paths);
        reflectButtonStates();
        return;
      }
      const step = event.shiftKey ? 5 : 1;
      const handleKind = handle?.dataset.stageHandle;
      const scaleDirection = event.key === "ArrowRight" || event.key === "ArrowUp" ? 1
        : event.key === "ArrowLeft" || event.key === "ArrowDown" ? -1 : 0;
      let changed = false;
      const adjust = (path, delta, minimum, maximum) => {
        setStageOverride(path, clampNumber((Number(stageValue(path)) || 0) + delta, minimum, maximum));
        changed = true;
      };
      if (selection.kind === "layer") {
        const index = layerIndexForId(selection.id);
        if (index < 0) return;
        const prefix = `layers[${index}].frames.${stageViewport}.`;
        if (handleKind === "scale" && scaleDirection) {
          adjust(`${prefix}scale`, scaleDirection * (event.shiftKey ? 0.2 : 0.05), 0.25, 3);
        } else if (handleKind === "move") {
          const horizontal = handle.dataset.side === "e" || handle.dataset.side === "w";
          if (horizontal && event.key === "ArrowLeft") adjust(`${prefix}positionX`, -step, -100, 100);
          else if (horizontal && event.key === "ArrowRight") adjust(`${prefix}positionX`, step, -100, 100);
          else if (!horizontal && event.key === "ArrowUp") adjust(`${prefix}positionY`, -step, -100, 100);
          else if (!horizontal && event.key === "ArrowDown") adjust(`${prefix}positionY`, step, -100, 100);
        } else if (event.key === "ArrowLeft") adjust(`${prefix}positionX`, -step, -100, 100);
        else if (event.key === "ArrowRight") adjust(`${prefix}positionX`, step, -100, 100);
        else if (event.key === "ArrowUp") adjust(`${prefix}positionY`, -step, -100, 100);
        else if (event.key === "ArrowDown") adjust(`${prefix}positionY`, step, -100, 100);
        else if (event.key === "+" || event.key === "=") adjust(`${prefix}scale`, event.shiftKey ? 0.2 : 0.05, 0.25, 3);
        else if (event.key === "-" || event.key === "_") adjust(`${prefix}scale`, event.shiftKey ? -0.2 : -0.05, 0.25, 3);
      } else {
        seedNativePromptOverrides();
        const ratioStep = step / 100;
        if (handleKind === "scale" && scaleDirection) {
          adjust("shared.prompt.width", scaleDirection * ratioStep, 0.4, 0.96);
        } else if (handleKind === "move") {
          const horizontal = handle.dataset.side === "e" || handle.dataset.side === "w";
          if (horizontal && event.key === "ArrowLeft") adjust("shared.prompt.x", -ratioStep, -0.35, 0.35);
          else if (horizontal && event.key === "ArrowRight") adjust("shared.prompt.x", ratioStep, -0.35, 0.35);
          else if (!horizontal && event.key === "ArrowUp") adjust("shared.prompt.y", -ratioStep, -0.3, 0.3);
          else if (!horizontal && event.key === "ArrowDown") adjust("shared.prompt.y", ratioStep, -0.3, 0.3);
        } else if (event.key === "ArrowLeft") adjust("shared.prompt.x", -ratioStep, -0.35, 0.35);
        else if (event.key === "ArrowRight") adjust("shared.prompt.x", ratioStep, -0.35, 0.35);
        else if (event.key === "ArrowUp") adjust("shared.prompt.y", -ratioStep, -0.3, 0.3);
        else if (event.key === "ArrowDown") adjust("shared.prompt.y", ratioStep, -0.3, 0.3);
        else if (event.key === "[") adjust("shared.prompt.width", -0.02, 0.4, 0.96);
        else if (event.key === "]") adjust("shared.prompt.width", 0.02, 0.4, 0.96);
      }
      if (!changed) return;
      event.preventDefault();
      stageSelection = selection;
      applyStageLayout();
      reflectStageInputs(stageItemPaths(selection));
      if (stageKeyTimer) clearTimeout(stageKeyTimer);
      const paths = stageItemPaths(selection);
      for (const path of paths) stageKeyPaths.add(path);
      stageKeyTimer = setTimeout(flushStageKeyChanges, 220);
      reflectButtonStates();
    });

    const previewWidthInput = document.getElementById("stage-real-width");
    const previewHeightInput = document.getElementById("stage-real-height");
    const setPreviewInputValues = (width, height) => {
      if (previewWidthInput) previewWidthInput.value = String(width);
      if (previewHeightInput) previewHeightInput.value = String(height);
    };
    const reflectStageViewport = () => {
      for (const input of stageViewportInputs) input.checked = input.value === stageViewport;
    };
    const readPreviewInputSize = ({ clamp = false } = {}) => {
      let width = Math.round(Number(previewWidthInput?.value));
      let height = Math.round(Number(previewHeightInput?.value));
      if (clamp) {
        width = Math.round(clampNumber(width || 1180, 920, 3840));
        height = Math.round(clampNumber(height || 640, 620, 2400));
      }
      return integer(width, 920, 3840) && integer(height, 620, 2400) ? [width, height] : null;
    };
    const updatePreviewDraft = (dimensions) => {
      if (!dimensions) return false;
      previewSizeIntent = [...dimensions];
      stagePreviewSize = dimensions;
      stageViewport = dimensions[0] >= 1440 ? "wide" : "normal";
      reflectStageViewport();
      selectStageMirror();
      renderStage();
      return true;
    };
    const commitPreviewSize = ({ clamp = false, notify = false } = {}) => {
      if (previewResizeTimer) { clearTimeout(previewResizeTimer); previewResizeTimer = null; }
      const dimensions = readPreviewInputSize({ clamp });
      if (!dimensions) return false;
      setPreviewInputValues(...dimensions);
      updatePreviewDraft(dimensions);
      if (!sendPreviewSize(`${dimensions[0]}x${dimensions[1]}`, dimensions)) return false;
      if (notify) announce(tr("stageRealShown"));
      return true;
    };
    const schedulePreviewSize = () => {
      if (previewResizeTimer) {
        clearTimeout(previewResizeTimer);
        previewResizeTimer = null;
      }
      const dimensions = readPreviewInputSize();
      if (!dimensions) {
        previewSizeIntent = null;
        previewExpectedRequest = null;
        return;
      }
      updatePreviewDraft(dimensions);
      previewResizeTimer = setTimeout(() => {
        previewResizeTimer = null;
        commitPreviewSize();
      }, 160);
    };
    const sendPreviewSize = (size, dimensions = null) => {
      const request = previewRequestSerial + 1;
      previewRequestSerial = request;
      previewExpectedRequest = request;
      previewSizeEditing = true;
      previewSizeIntent = dimensions ? [...dimensions] : null;
      if (send({ type: "set-aura-preview", size, request })) return true;
      previewExpectedRequest = null;
      return false;
    };

    stageViewportInputs.forEach((input) => input.addEventListener("change", () => {
      if (!input.checked) return;
      stageViewport = input.value;
      stagePreviewSize = [...STAGE_SIZES[stageViewport]];
      setPreviewInputValues(...stagePreviewSize);
      // Viewport controls resize Aura without foregrounding it; the next
      // private capture becomes the stage backdrop while Studio stays usable.
      sendPreviewSize(input.value === "wide" ? "wide" : "launch", stagePreviewSize);
      selectStageMirror();
      renderStage();
    }));
    stageContextInputs.forEach((input) => input.addEventListener("change", () => {
      if (!input.checked) return;
      stageContextTouched = true;
      stageContext = input.value;
      selectStageMirror();
      renderStage();
      announce(format(tr("stageContextSelected"), stageContextLabel()));
    }));
    switchSupportedPreviewButton?.addEventListener("click", () => {
      stageContextTouched = true;
      stageContext = "new-chat";
      for (const input of stageContextInputs) input.checked = input.value === stageContext;
      selectStageMirror();
      renderStage();
      announce(format(tr("stageContextSelected"), stageContextLabel()));
    });
    stageZonesInput?.addEventListener("change", () => {
      stageRoot.dataset.zones = String(stageZonesInput.checked);
    });
    backdropToggleInput?.addEventListener("change", () => {
      if (backdropToggleInput.checked && hasUsableMirrorGeometry(stageLiveMirror)) {
        stageViewport = stageLiveMirror.geometry.viewport;
        reflectStageViewport();
      }
      selectStageMirror();
      renderStage();
    });
    const levelInputs = [...document.querySelectorAll('input[name="editor-level"]')];
    levelInputs.forEach((input) => input.addEventListener("change", () => {
      if (!input.checked) return;
      editor.dataset.level = input.value;
      if (input.value === "simple") {
        for (const details of tokenGroups.querySelectorAll(".quick-essential")) details.open = true;
      }
      setInspectorTarget(inspectorTarget);
      renderStage();
    }));
    for (const [id, size] of [["stage-real-full", "full"]]) {
      document.getElementById(id)?.addEventListener("click", () => {
        if (!sendPreviewSize(size)) return;
        stageViewport = "wide";
        reflectStageViewport();
        renderStage();
        announce(tr("stageRealShown"));
      });
    }
    // Real-window mirror: scaled captures of the actual Aura WebView pushed
    // by the host. True proportions at any window size, never written to disk.
    const mirrorCaption = document.getElementById("stage-mirror-caption");
    const MIRROR_PREFIX = "data:image/jpeg;base64,";
    const MIRROR_MAX_RAW_BYTES = 8_000_000;
    const MIRROR_MAX_BASE64_LENGTH = Math.ceil(MIRROR_MAX_RAW_BYTES / 3) * 4;
    const normalizeMirrorRect = (value) => {
      if (value === null || value === undefined) return null;
      if (!exactShape(value, ["left", "top", "width", "height"])) return undefined;
      for (const key of ["left", "top", "width", "height"]) {
        if (!inRange(value[key], -10000, 10000)) return undefined;
      }
      return { ...value };
    };
    const normalizeMirror = (value) => {
      if (!exactShape(value, ["type", "image", "width", "height", "revision", "request"], ["geometry"])
          || value.type !== "aura-mirror" || !integer(value.revision, 0, Number.MAX_SAFE_INTEGER)
          || !integer(value.request, 0, 2_147_483_647)) return null;
      if (typeof value.image !== "string" || !value.image.startsWith(MIRROR_PREFIX)
          || value.image.length > MIRROR_PREFIX.length + MIRROR_MAX_BASE64_LENGTH) return null;
      const encoded = value.image.slice(MIRROR_PREFIX.length);
      if (encoded.length > MIRROR_MAX_BASE64_LENGTH || encoded.length % 4 !== 0
          || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) return null;
      const padding = encoded.endsWith("==") ? 2 : encoded.endsWith("=") ? 1 : 0;
      if ((encoded.length / 4 * 3) - padding > MIRROR_MAX_RAW_BYTES) return null;
      if (!integer(value.width, 200, 6000) || !integer(value.height, 200, 6000)) return null;
      let geometry = null;
      if (value.geometry !== undefined && value.geometry !== null) {
        if (!exactShape(value.geometry, ["context", "mode", "viewport", "main", "prompt"])
            || !enumValue(value.geometry.context, ["new-chat", "conversation", "other"])
            || !enumValue(value.geometry.mode, ["light", "dark"])
            || !enumValue(value.geometry.viewport, ["normal", "wide"])) return null;
        const main = normalizeMirrorRect(value.geometry.main);
        const prompt = normalizeMirrorRect(value.geometry.prompt);
        if (main === undefined || prompt === undefined) return null;
        geometry = {
          context: value.geometry.context, mode: value.geometry.mode,
          viewport: value.geometry.viewport, main, prompt,
        };
      }
      return {
        image: value.image, width: value.width, height: value.height,
        revision: value.revision, request: value.request, geometry,
      };
    };
    const mirrorBasis = (revision, mode, viewport, width, height) => (
      `${revision}|${mode}|${viewport}|${width}x${height}`
    );
    const rememberStageMirror = (mirror) => {
      const { geometry } = mirror;
      if (mirror.revision !== state?.revision || !hasUsableMirrorGeometry(mirror)) return;
      const basis = mirrorBasis(
        mirror.revision, geometry.mode, geometry.viewport, mirror.width, mirror.height,
      );
      if (stageMirrorCacheBasis !== basis) {
        stageMirrorCache.clear();
        stageMirrorCacheBasis = basis;
      }
      // One exact-size, exact-appearance capture per page context. The cache
      // is bounded to two in-memory JPEGs and is cleared when editing closes.
      stageMirrorCache.set(geometry.context, mirror);
    };
    const updateMirrorCaption = () => {
      if (!mirrorCaption) return;
      if (!stageMirror) {
        mirrorCaption.textContent = stageLiveMirror
          ? format(tr("mirrorUnavailable"), stageContextLabel())
          : tr("mirrorEmpty");
        return;
      }
      const key = stageMirror === stageLiveMirror ? "mirrorCaption" : "mirrorCaptionCached";
      mirrorCaption.textContent = format(
        tr(key), stageMirror.width, stageMirror.height, stageContextLabel(stageMirror.geometry?.context),
      );
    };
    const selectStageMirror = () => {
      if (!hasUsableMirrorGeometry(stageLiveMirror)) {
        stageMirror = null;
        updateMirrorCaption();
        return;
      }
      const basis = mirrorBasis(
        state?.revision ?? -1, selectedMode, stageViewport, stagePreviewSize[0], stagePreviewSize[1],
      );
      stageMirror = basis === stageMirrorCacheBasis
        ? stageMirrorCache.get(stageContext) ?? null
        : null;
      updateMirrorCaption();
    };
    const receiveMirror = (raw) => {
      const mirror = normalizeMirror(raw);
      if (!mirror || mirror.revision !== state?.revision) return false;
      if (previewExpectedRequest !== null && mirror.request !== previewExpectedRequest) return false;
      if (previewSizeEditing) {
        if (previewExpectedRequest === null && !previewSizeIntent) return false;
        if (previewSizeIntent
            && (mirror.width !== previewSizeIntent[0] || mirror.height !== previewSizeIntent[1])) return false;
        previewSizeEditing = false;
        previewSizeIntent = null;
        previewExpectedRequest = null;
      }
      const previousContext = stageLiveMirror?.geometry?.context;
      const previousMode = stageLiveMirror?.geometry?.mode;
      const first = !stageLiveMirror;
      stageLiveMirror = mirror;
      rememberStageMirror(mirror);
      stagePreviewSize = [mirror.width, mirror.height];
      setPreviewInputValues(mirror.width, mirror.height);
      if (backdropToggleInput?.checked) {
        // The framing set being edited follows the real window's dimensions,
        // while an explicit page selection stays pinned. Captures from both
        // contexts remain switchable without repeatedly foregrounding Aura.
        if (!hasUsableMirrorGeometry(mirror)) {
          stageMirror = null;
          updateMirrorCaption();
          renderStage();
          return true;
        }
        stageViewport = mirror.geometry.viewport;
        reflectStageViewport();
        const realContext = mirror.geometry?.context;
        if ((realContext === "new-chat" || realContext === "conversation")
            && !stageContextTouched && (first || realContext !== previousContext)) {
          stageContext = realContext;
        }
        const realMode = mirror.geometry?.mode;
        if (realMode && !appearanceTouched && realMode !== selectedMode
            && (first || realMode !== previousMode)) {
          selectedMode = realMode;
          for (const input of modeInputs) input.checked = input.value === selectedMode;
          reflectTokens();
        }
        selectStageMirror();
        if (first && stageMirror) announce(tr("stageBackdropReady"));
        renderStage();
        if (stageDrag && stageBackdropOn()) {
          stageBackdropImg.src = mirror.image;
          stageBackdropImg.hidden = false;
        }
      }
      return true;
    };
    document.getElementById("stage-mirror-refresh")?.addEventListener("click", () => {
      if (mirrorCaption) mirrorCaption.textContent = tr("mirrorEmpty");
      send({ type: "refresh-aura-mirror" });
    });
    document.getElementById("stage-open-aura")?.addEventListener("click", () => {
      send({ type: "open-aura" });
    });
    topmostButton?.addEventListener("click", () => {
      if (!send({ type: "set-aura-topmost", enabled: !topmostEnabled })) return;
      topmostEnabled = !topmostEnabled;
      topmostButton.setAttribute("aria-pressed", String(topmostEnabled));
      announce(tr(topmostEnabled ? "topmostOn" : "topmostOff"));
    });
    for (const input of [previewWidthInput, previewHeightInput]) {
      input?.addEventListener("input", () => {
        previewSizeEditing = true;
        schedulePreviewSize();
      });
      input?.addEventListener("change", () => commitPreviewSize({ clamp: true }));
    }
    // State matrix: light/dark × new-chat/conversation at a glance. The four
    // cells and their layer images are built once and reconciled on every
    // render so a redraw never re-decodes artwork or rebinds click handlers.
    const matrixHost = document.getElementById("stage-matrix");
    const matrixCells = [];

    const buildMatrixCells = () => {
      matrixHost.replaceChildren();
      matrixCells.length = 0;
      for (const mode of ["light", "dark"]) {
        for (const context of ["new-chat", "conversation"]) {
          const cell = document.createElement("button");
          cell.type = "button";
          cell.className = "stage-matrix-cell";
          const frame = document.createElement("span");
          frame.className = "stage-matrix-frame";
          const canvas = document.createElement("span");
          canvas.className = "stage-matrix-canvas";
          const art = document.createElement("span");
          art.className = "stage-art";
          const sidebar = document.createElement("span");
          sidebar.className = "stage-matrix-sidebar";
          const block = document.createElement("span");
          block.className = "stage-matrix-block";
          canvas.append(art, sidebar, block);
          frame.appendChild(canvas);
          const caption = document.createElement("small");
          cell.append(frame, caption);
          cell.addEventListener("click", () => {
            if (selectedMode !== mode) {
              appearanceTouched = true;
              send({ type: "set-appearance", appearance: mode });
            }
            selectedMode = mode;
            stageContextTouched = true;
            stageContext = context;
            for (const input of modeInputs) input.checked = input.value === selectedMode;
            selectStageMirror();
            reflectTokens();
            renderStage();
          });
          matrixHost.appendChild(cell);
          matrixCells.push({ mode, context, cell, frame, canvas, art, sidebar, block, caption, layers: new Map() });
        }
      }
    };

    const reconcileMatrixLayers = (entry) => {
      const seen = new Set();
      let previous = null;
      for (const layer of state.layers) {
        if (layer.visible === false || !layer.previewUrl) continue;
        if (layer.appearance !== "all" && layer.appearance !== entry.mode) continue;
        if (layer.context !== "all" && layer.context !== entry.context) continue;
        if (layer.viewport !== "all" && layer.viewport !== stageViewport) continue;
        seen.add(layer.index);
        let node = entry.layers.get(layer.index);
        if (node && node.previewUrl !== layer.previewUrl) {
          node.holder.remove();
          entry.layers.delete(layer.index);
          node = null;
        }
        if (!node) {
          const holder = document.createElement("span");
          holder.className = "stage-layer";
          const image = document.createElement("img");
          image.src = layer.previewUrl;
          image.alt = "";
          image.setAttribute("draggable", "false");
          holder.appendChild(image);
          node = { holder, image, previewUrl: layer.previewUrl };
          entry.layers.set(layer.index, node);
        }
        node.holder.dataset.mask = layer.mask;
        node.holder.style.opacity = String(layer.opacity);
        const frameValues = layer.frames[stageViewport];
        const anchor = ANCHOR_POINTS[frameValues.anchor] ?? ANCHOR_POINTS.center;
        node.image.style.left = `calc(${anchor[0]}% + ${frameValues.positionX}%)`;
        node.image.style.top = `calc(${anchor[1]}% + ${frameValues.positionY}%)`;
        node.image.style.transform = `translate(${-frameValues.focalX}%, ${-frameValues.focalY}%) scale(${frameValues.scale})`;
        node.image.style.transformOrigin = `${frameValues.focalX}% ${frameValues.focalY}%`;
        if (previous) previous.after(node.holder);
        else entry.art.prepend(node.holder);
        previous = node.holder;
      }
      for (const [index, node] of [...entry.layers]) {
        if (!seen.has(index)) {
          node.holder.remove();
          entry.layers.delete(index);
        }
      }
    };

    const renderStageMatrix = () => {
      if (!matrixHost) return;
      if (!state) {
        if (matrixCells.length) {
          matrixHost.replaceChildren();
          matrixCells.length = 0;
        }
        return;
      }
      if (!matrixCells.length) buildMatrixCells();
      const [logicalWidth, logicalHeight] = STAGE_SIZES[stageViewport];
      const hostWidth = matrixHost.clientWidth;
      const cellWidth = hostWidth > 40 ? Math.max(60, (hostWidth - 30) / 4) : 132;
      const cellScale = cellWidth / logicalWidth;
      const frameHeight = `${Math.round(logicalHeight * cellScale)}px`;
      const scope = state.shared.backgroundScope;
      const artLeft = scope === "content" ? `${STAGE_SIDEBAR_WIDTH}px` : "0";
      const mainWidth = logicalWidth - STAGE_SIDEBAR_WIDTH;
      for (const entry of matrixCells) {
        const { mode, context, cell } = entry;
        const tokens = state.tokens[mode];
        cell.dataset.active = String(mode === selectedMode && context === stageContext);
        const modeLabel = tr(mode === "light" ? "lightMode" : "darkMode");
        const contextLabel = tr(context === "new-chat" ? "stageNewChat" : "stageConversation");
        cell.setAttribute("aria-label", `${modeLabel} · ${contextLabel}`);
        entry.caption.textContent = `${modeLabel} · ${contextLabel}`;
        entry.frame.style.width = `${cellWidth}px`;
        entry.frame.style.height = frameHeight;
        entry.canvas.style.width = `${logicalWidth}px`;
        entry.canvas.style.height = `${logicalHeight}px`;
        entry.canvas.style.transform = `scale(${cellScale})`;
        entry.canvas.style.background = tokens.canvas;
        entry.art.style.left = artLeft;
        reconcileMatrixLayers(entry);
        entry.sidebar.style.width = `${STAGE_SIDEBAR_WIDTH}px`;
        entry.sidebar.style.background = scope === "full-window"
          ? `color-mix(in srgb, ${tokens.sidebar} ${Math.round(tokens.sidebarAlpha * 100)}%, transparent)`
          : tokens.sidebar;
        const block = entry.block;
        block.style.background = `color-mix(in srgb, ${tokens.surface} ${Math.round(tokens.surfaceAlpha * 100)}%, transparent)`;
        block.style.border = `1px solid ${tokens.border}`;
        block.style.borderRadius = `${state.shared.radius}px`;
        if (context === "new-chat") {
          const rect = promptRect(logicalWidth, logicalHeight,
            state.shared.prompt.width, state.shared.prompt.x, state.shared.prompt.y);
          block.style.left = `${rect.left}px`;
          block.style.top = `${rect.top}px`;
          block.style.width = `${rect.width}px`;
          block.style.height = `${rect.height}px`;
        } else {
          block.style.left = `${STAGE_SIDEBAR_WIDTH + (mainWidth * 0.14)}px`;
          block.style.top = `${logicalHeight - 134}px`;
          block.style.width = `${mainWidth * 0.72}px`;
          block.style.height = "110px";
        }
      }
    };

    // Layer cards flag artwork that the current stage view hides.
    const updateLayerGateBadges = () => {
      if (!state) return;
      for (const layer of state.layers) {
        const gated = !stageLayerGate(layer);
        const card = layerList.querySelector(`[data-layer-id="${CSS.escape(layer.id)}"]`);
        const badge = layerList.querySelector(`[data-layer-badge="${layer.index}"]`);
        if (card) {
          card.dataset.gated = String(gated);
          for (const control of card.querySelectorAll(".layer-preset, [data-layer-state-edit]")) {
            control.disabled = gated;
            if (control.classList.contains("layer-preset")) control.dataset.gated = String(gated);
          }
        }
        if (!badge) continue;
        const reasons = [];
        if (layer.appearance !== "all" && layer.appearance !== selectedMode) {
          reasons.push(tr(layer.appearance === "light" ? "appearanceLight" : "appearanceDark"));
        }
        if (layer.context !== "all" && layer.context !== stageContext) {
          reasons.push(tr(layer.context === "new-chat" ? "contextNewChat" : "contextConversation"));
        }
        if (layer.viewport !== "all" && layer.viewport !== stageViewport) {
          reasons.push(tr(layer.viewport === "normal" ? "viewportNormal" : "viewportWide"));
        }
        badge.hidden = !reasons.length;
        if (reasons.length) badge.textContent = format(tr("hiddenInStageView"), reasons.join(" · "));
      }
    };

    const copyLayerFraming = (index, source, target) => {
      const frame = state?.layers?.[index]?.frames?.[source];
      if (!frame) return;
      queueStageMutations(["anchor", "focalX", "focalY", "positionX", "positionY", "scale"].map((property) => (
        { type: "set-theme-layer", index, preset: target, property, value: frame[property] }
      )));
      announce(format(tr("framingCopied"), tr(target === "wide" ? "stageWide" : "stageNormal")));
    };
    if (typeof ResizeObserver === "function") {
      const stageLayoutObserver = new ResizeObserver(() => applyStageLayout());
      stageLayoutObserver.observe(stageRoot);
      if (stageColumn) stageLayoutObserver.observe(stageColumn);
    } else {
      window.addEventListener("resize", applyStageLayout, { passive: true });
    }
    // ── End live framing stage ─────────────────────────────────────────

    const buildTokenControls = () => {
      for (const group of TOKEN_GROUPS) {
        const details = document.createElement("details");
        const quickEssential = ["groupCanvas", "groupSurface", "groupText", "groupAccent"].includes(group.label);
        details.className = `token-group${quickEssential ? " quick-essential" : " advanced-only"}`;
        if (["groupCanvas", "groupSurface", "groupText", "groupAccent"].includes(group.label)) details.open = true;
        const groupSummary = document.createElement("summary");
        groupSummary.textContent = tr(group.label);
        const fields = document.createElement("div");
        fields.className = "token-group-fields";
        for (const [token, labelKey] of group.fields) {
          if (COLOR_TOKEN_KEYS.has(token)) {
            const row = document.createElement("label");
            row.className = "color-field";
            const label = document.createElement("span");
            label.textContent = tr(labelKey);
            const chip = document.createElement("span");
            chip.className = "contrast-chip";
            chip.dataset.contrastChip = token;
            chip.hidden = true;
            label.appendChild(chip);
            const picker = document.createElement("input");
            picker.type = "color";
            picker.dataset.editorToken = token;
            picker.dataset.editorFocus = `token-${token}-picker`;
            picker.setAttribute("aria-label", tr(labelKey));
            const text = document.createElement("input");
            text.type = "text";
            text.maxLength = 7;
            text.inputMode = "text";
            text.spellcheck = false;
            text.dataset.editorTokenText = token;
            text.dataset.editorFocus = `token-${token}-text`;
            text.setAttribute("aria-label", `${tr(labelKey)} HEX`);
            picker.addEventListener("input", () => {
              text.value = picker.value.toUpperCase();
              text.removeAttribute("aria-invalid");
              setStageOverride(picker.dataset.editorField, picker.value.toUpperCase());
              applyStageLayout();
            });
            picker.addEventListener("change", () => queueTokenChange(selectedMode, token, picker.value.toUpperCase()));
            text.addEventListener("change", () => {
              const value = text.value.trim().toUpperCase();
              if (!COLOR_PATTERN.test(value)) {
                text.setAttribute("aria-invalid", "true");
                announce(tr("editorActionFailed"), "error");
                return;
              }
              text.removeAttribute("aria-invalid");
              picker.value = value;
              setStageOverride(text.dataset.editorField, value);
              applyStageLayout();
              queueTokenChange(selectedMode, token, value);
            });
            row.append(label, picker, text);
            fields.appendChild(row);
          } else {
            const row = document.createElement("label");
            row.className = "alpha-field";
            const label = document.createElement("span");
            label.textContent = tr(labelKey);
            const range = document.createElement("input");
            range.type = "range";
            range.min = token === "surfaceAlpha" ? "35" : "62";
            range.max = "100";
            range.step = "1";
            range.dataset.editorToken = token;
            range.dataset.editorFocus = `token-${token}`;
            const output = document.createElement("output");
            output.htmlFor = range.id;
            range.addEventListener("input", () => {
              output.value = `${range.value}%`;
              setStageOverride(range.dataset.editorField, Number(range.value) / 100);
              applyStageLayout();
            });
            range.addEventListener("change", () => queueTokenChange(selectedMode, token, Number(range.value) / 100));
            row.append(label, range, output);
            fields.appendChild(row);
          }
        }
        details.append(groupSummary, fields);
        tokenGroups.appendChild(details);
      }
    };

    const reflectTokens = () => {
      if (!state) return;
      const mode = state.tokens[selectedMode];
      for (const input of tokenGroups.querySelectorAll("[data-editor-token]")) {
        const token = input.dataset.editorToken;
        input.dataset.editorField = `tokens.${selectedMode}.${token}`;
        const value = stageValue(input.dataset.editorField) ?? mode[token];
        if (input.type === "color") {
          input.value = value;
          const text = tokenGroups.querySelector(`[data-editor-token-text="${token}"]`);
          if (text) {
            text.value = value;
            text.dataset.editorField = `tokens.${selectedMode}.${token}`;
          }
        } else {
          input.value = String(Math.round(value * 100));
          input.nextElementSibling.value = `${Math.round(value * 100)}%`;
        }
      }
      const checks = state.feedback.contrast[selectedMode] ?? [];
      for (const chip of tokenGroups.querySelectorAll("[data-contrast-chip]")) {
        const related = checks.filter((check) => (CONTRAST_TOKEN_MAP[chip.dataset.contrastChip] ?? []).includes(check.id));
        if (!related.length) {
          chip.hidden = true;
          continue;
        }
        const pass = related.every((check) => check.pass);
        const worst = related.reduce((left, right) => (left.ratio / left.minimum) <= (right.ratio / right.minimum) ? left : right);
        chip.textContent = `${worst.ratio.toFixed(1)}:1`;
        chip.dataset.pass = String(pass);
        chip.setAttribute("aria-label",
          `${tr(CONTRAST_LABEL_KEYS[worst.id])} ${worst.ratio.toFixed(2)} / ${worst.minimum.toFixed(2)} · ${tr(pass ? "checkPass" : "checkFail")}`);
        chip.title = tr(pass ? "checkPass" : "checkFail");
        chip.hidden = false;
      }
    };

    const reflectShared = () => {
      if (!state) return;
      const values = state.shared;
      for (const input of sharedInputs) {
        const key = input.dataset.editorShared;
        const path = `shared.${key}`;
        const value = stageValue(path) ?? values[key];
        if (input.tagName === "SELECT" && ["fontUi", "fontDisplay", "shadow"].includes(key)) {
          setInheritedSelectPresentation(input, values.inherited[key] && !stageOverrides.has(path), value);
        } else {
          input.value = String(value);
        }
      }
      const radius = Number(stageValue("shared.radius") ?? values.radius);
      const blur = Number(stageValue("shared.blur") ?? values.blur);
      const backgroundScope = stageValue("shared.backgroundScope") ?? values.backgroundScope;
      setInheritedRadiusPresentation(values.inherited.radius && !stageOverrides.has("shared.radius"));
      document.getElementById("editor-radius-output").value = `${Math.round(radius)} px`;
      document.getElementById("editor-blur-output").value = `${Math.round(blur)} px`;
      for (const input of scopeInputs) input.checked = input.value === backgroundScope;
      document.getElementById("background-scope-help").textContent = tr(
        backgroundScope === "full-window" ? "fullScopeHelp" : "contentScopeHelp");
      document.querySelector(".asset-guide-frame").dataset.scope = backgroundScope;
      for (const input of promptInputs) {
        const key = input.dataset.editorPrompt;
        const value = Number(stageValue(`shared.prompt.${key}`) ?? values.prompt[key]);
        input.value = String(Math.round(value * 100));
        const exact = document.getElementById(`${input.id}-exact`);
        if (exact) exact.value = input.value;
        const output = document.getElementById(`${input.id}-output`);
        if (output) output.value = `${Math.round(value * 100)}%`;
      }
      if (nativePromptNote) {
        nativePromptNote.hidden = !values.prompt.native
          || STAGE_PROMPT_PATHS.some((path) => stageOverrides.has(path));
      }
    };

    const reflectLauncher = () => {
      if (!state) return;
      for (const input of launcherInputs) {
        const key = input.dataset.editorLauncher;
        const value = stageValue(`launcher.${key}`) ?? state.launcher[key];
        input.dataset.editorField = `launcher.${key}`;
        input.value = String(value);
        if (input.type === "color") {
          const text = launcherTextInputs.find((candidate) => candidate.dataset.editorLauncherText === key);
          if (text) {
            text.value = String(value);
            text.dataset.editorField = `launcher.${key}`;
          }
        }
      }
      const radius = Number(stageValue("launcher.radius") ?? state.launcher.radius);
      const borderWidth = Number(stageValue("launcher.borderWidth") ?? state.launcher.borderWidth);
      document.getElementById("editor-launcher-radius-output").value = `${Math.round(radius)} px`;
      document.getElementById("editor-launcher-border-width-output").value = `${Math.round(borderWidth)} px`;
      if (launcherPreview) {
        const read = (key) => stageValue(`launcher.${key}`) ?? state.launcher[key];
        launcherPreview.style.background = read("surface");
        launcherPreview.style.color = read("foreground");
        launcherPreview.style.borderColor = read("border");
        launcherPreview.style.borderWidth = `${borderWidth}px`;
        launcherPreview.style.borderRadius = `${radius}px`;
        launcherPreview.style.setProperty("--editor-launcher-hover", read("surfaceHover"));
        launcherPreview.style.setProperty("--editor-launcher-accent", read("accent"));
      }
      if (launcherMark) {
        const source = state.launcherPreviewUrl;
        if (launcherMark.src !== source) launcherMark.src = source;
      }
    };

    const reflectMetadata = () => {
      if (!state) return;
      for (const input of metadataInputs) {
        const collection = input.dataset.editorMetadata === "label" ? "labels" : "descriptions";
        const path = `metadata.${collection}.${input.dataset.editorLocale}`;
        input.value = String(stageValue(path) ?? "");
      }
    };

    const option = (value, label) => {
      const node = document.createElement("option");
      node.value = value;
      node.textContent = label;
      return node;
    };

    const layerSelect = ({ layer, preset = "shared", property, labelKey, values, quick = false }) => {
      const field = document.createElement("label");
      field.className = `layer-field${quick ? "" : " advanced-only"}`;
      const label = document.createElement("span");
      label.textContent = tr(labelKey);
      const select = document.createElement("select");
      select.dataset.editorFocus = `layer-${layer.id}-${preset}-${property}`;
      select.dataset.editorField = preset === "shared"
        ? `layers[${layer.index}].${property}`
        : `layers[${layer.index}].frames.${preset}.${property}`;
      for (const [value, key] of values) select.appendChild(option(value, tr(key)));
      select.value = String(stageValue(select.dataset.editorField)
        ?? (preset === "shared" ? layer[property] : layer.frames[preset][property]));
      select.addEventListener("change", () => {
        setStageOverride(select.dataset.editorField, select.value);
        queueLayerChange(layer.index, preset, property, select.value);
        renderStage();
      });
      field.append(label, select);
      return field;
    };

    const layerRange = ({ layer, preset = "shared", property, labelKey, min, max, step, value, display }) => {
      const field = document.createElement("label");
      field.className = "layer-field advanced-only";
      const label = document.createElement("span");
      label.textContent = tr(labelKey);
      const output = document.createElement("output");
      const range = document.createElement("input");
      range.type = "range";
      range.min = String(min);
      range.max = String(max);
      range.step = String(step);
      range.value = String(stageValue(preset === "shared"
        ? `layers[${layer.index}].${property}`
        : `layers[${layer.index}].frames.${preset}.${property}`) ?? value);
      range.dataset.editorFocus = `layer-${layer.id}-${preset}-${property}`;
      range.dataset.editorField = preset === "shared"
        ? `layers[${layer.index}].${property}`
        : `layers[${layer.index}].frames.${preset}.${property}`;
      const exact = document.createElement("input");
      exact.type = "number";
      exact.className = "layer-exact-value";
      exact.min = String(min);
      exact.max = String(max);
      exact.step = String(step);
      exact.value = range.value;
      exact.inputMode = "decimal";
      exact.dataset.editorFocus = `layer-${layer.id}-${preset}-${property}-number`;
      exact.dataset.editorField = range.dataset.editorField;
      exact.setAttribute("aria-label", `${tr(labelKey)} · ${tr("exactValue")}`);
      const pair = document.createElement("span");
      pair.className = "layer-range-pair";
      const formatValue = () => display(range.valueAsNumber);
      output.value = formatValue();
      range.addEventListener("input", () => {
        exact.value = range.value;
        output.value = formatValue();
        setStageOverride(range.dataset.editorField, range.valueAsNumber);
        applyStageLayout();
      });
      range.addEventListener("change", () => queueLayerChange(layer.index, preset, property, range.valueAsNumber));
      exact.addEventListener("input", () => {
        if (!Number.isFinite(exact.valueAsNumber)) return;
        const next = clampNumber(exact.valueAsNumber, min, max);
        range.value = String(next);
        output.value = display(next);
        setStageOverride(range.dataset.editorField, next);
        applyStageLayout();
      });
      exact.addEventListener("change", () => {
        if (!Number.isFinite(exact.valueAsNumber)) {
          exact.value = range.value;
          return;
        }
        const next = clampNumber(exact.valueAsNumber, min, max);
        exact.value = String(next);
        range.value = String(next);
        queueLayerChange(layer.index, preset, property, next);
      });
      label.append(" ", output);
      pair.append(range, exact);
      field.append(label, pair);
      return field;
    };

    const renderFrame = (layer, preset, disabled = false) => {
      const frame = layer.frames[preset];
      const fieldset = document.createElement("fieldset");
      fieldset.className = "layer-preset advanced-only";
      fieldset.disabled = disabled;
      fieldset.dataset.gated = String(disabled);
      const legend = document.createElement("legend");
      legend.textContent = tr(preset === "normal" ? "normalPreset" : "widePreset");
      const grid = document.createElement("div");
      grid.className = "layer-grid";
      grid.append(
        layerSelect({
          layer, preset, property: "anchor", labelKey: "anchor",
          values: ANCHOR_OPTIONS,
        }),
        layerRange({ layer, preset, property: "focalX", labelKey: "focalX", min: 0, max: 100, step: 1, value: frame.focalX, display: (v) => `${Math.round(v)}%` }),
        layerRange({ layer, preset, property: "focalY", labelKey: "focalY", min: 0, max: 100, step: 1, value: frame.focalY, display: (v) => `${Math.round(v)}%` }),
        layerRange({ layer, preset, property: "positionX", labelKey: "positionX", min: -100, max: 100, step: 1, value: frame.positionX, display: (v) => `${Math.round(v)}%` }),
        layerRange({ layer, preset, property: "positionY", labelKey: "positionY", min: -100, max: 100, step: 1, value: frame.positionY, display: (v) => `${Math.round(v)}%` }),
        layerRange({ layer, preset, property: "scale", labelKey: "scale", min: 0.25, max: 3, step: 0.05, value: frame.scale, display: (v) => `${Math.round(v * 100)}%` }),
      );
      fieldset.append(legend, grid);
      return fieldset;
    };

    // Everything a card renders, so an unrelated edit (e.g. a colour tweak that
    // still triggers a full reflect) can leave the layer DOM — and its open,
    // scroll, and focus state — untouched instead of tearing it down and
    // reloading every thumbnail.
    const LAYER_SIGNATURE_SHARED = ["role", "appearance", "context", "viewport", "mask", "mobile", "opacity", "visible"];
    const LAYER_SIGNATURE_FRAME = ["anchor", "focalX", "focalY", "positionX", "positionY", "scale"];
    const layerRenderSignature = () => {
      const parts = [selectedLayerId, state.layers.length];
      for (const layer of state.layers) {
        const i = layer.index;
        parts.push(layer.id, i, layer.previewUrl ?? "", layer.bytes ?? "", stageLayerGate(layer) ? 1 : 0);
        for (const property of LAYER_SIGNATURE_SHARED) {
          parts.push(stageValue(`layers[${i}].${property}`) ?? layer[property]);
        }
        for (const preset of ["normal", "wide"]) {
          for (const property of LAYER_SIGNATURE_FRAME) {
            parts.push(stageValue(`layers[${i}].frames.${preset}.${property}`) ?? layer.frames[preset][property]);
          }
        }
      }
      return parts.join("");
    };

    const renderLayers = (focusKey = null) => {
      if (!state.layers.length) {
        selectedLayerId = null;
        if (renderedLayerSignature === "empty" && layerList.querySelector(".editor-layer-empty")) return;
        renderedLayerSignature = "empty";
        layerList.replaceChildren();
        const empty = document.createElement("p");
        empty.className = "editor-layer-empty";
        empty.textContent = tr("noLayers");
        layerList.appendChild(empty);
        refreshInspectorContext();
        return;
      }
      if (!layerForId(selectedLayerId)) selectedLayerId = state.layers[0].id;
      const signature = layerRenderSignature();
      if (signature === renderedLayerSignature && layerList.querySelector(".layer-card")) {
        refreshInspectorContext();
        return;
      }
      renderedLayerSignature = signature;
      layerList.replaceChildren();
      for (const layer of state.layers) {
        const gated = !stageLayerGate(layer);
        const card = document.createElement("details");
        card.className = "layer-card";
        card.dataset.editorLayer = String(layer.index);
        card.dataset.layerId = layer.id;
        card.dataset.selected = String(layer.id === selectedLayerId);
        card.open = layer.id === selectedLayerId;
        const cardSummary = document.createElement("summary");
        cardSummary.dataset.editorFocus = `layer-${layer.id}-summary`;
        cardSummary.addEventListener("click", () => {
          selectedLayerId = layer.id;
          selectStageItem({ kind: "layer", id: layer.id }, { reveal: false });
          requestAnimationFrame(() => {
            card.open = true;
            for (const sibling of layerList.querySelectorAll(".layer-card")) {
              const selected = sibling === card;
              sibling.dataset.selected = String(selected);
              if (!selected) sibling.open = false;
            }
          });
        });
        const preview = document.createElement("span");
        preview.className = "layer-preview";
        if (layer.previewUrl) {
          const image = document.createElement("img");
          image.src = layer.previewUrl;
          image.alt = "";
          image.setAttribute("aria-hidden", "true");
          preview.appendChild(image);
        } else preview.textContent = tr("noImagePreview");
        const summaryText = document.createElement("span");
        summaryText.className = "layer-summary-text";
        const strong = document.createElement("strong");
        const small = document.createElement("small");
        const role = String(stageValue(`layers[${layer.index}].role`) ?? layer.role);
        const appearance = String(stageValue(`layers[${layer.index}].appearance`) ?? layer.appearance);
        const context = String(stageValue(`layers[${layer.index}].context`) ?? layer.context);
        const roleLabel = tr(`role${role[0].toUpperCase()}${role.slice(1)}`);
        strong.textContent = format(tr("layerName"), roleLabel, layer.index + 1);
        const appearanceLabel = tr(`appearance${appearance === "all" ? "All" : appearance[0].toUpperCase() + appearance.slice(1)}`);
        const contextKey = context === "all" ? "contextAll" : context === "new-chat" ? "contextNewChat" : "contextConversation";
        small.textContent = format(tr("layerSummary"), roleLabel, appearanceLabel, tr(contextKey));
        const gateBadge = document.createElement("span");
        gateBadge.className = "layer-gate-badge";
        gateBadge.dataset.layerBadge = String(layer.index);
        gateBadge.hidden = true;
        summaryText.append(strong, small, gateBadge);
        const order = document.createElement("span");
        order.className = "layer-order";
        order.textContent = `${layer.index + 1}/${state.layers.length}`;
        cardSummary.append(preview, summaryText, order);

        const body = document.createElement("div");
        body.className = "layer-body";
        const inspectorTitle = document.createElement("h3");
        inspectorTitle.className = "layer-inspector-title";
        inspectorTitle.textContent = tr("layerInspectorTitle");
        const actions = document.createElement("div");
        actions.className = "layer-actions";
        const replace = document.createElement("button");
        replace.type = "button";
        replace.className = "ghost-button";
        replace.textContent = tr("replaceImage");
        replace.dataset.editorFocus = `layer-${layer.id}-replace`;
        replace.dataset.layerStructure = "";
        replace.addEventListener("click", () => {
          const base = mutationBase();
          const role = String(stageValue(`layers[${layer.index}].role`) ?? layer.role);
          const appearance = String(stageValue(`layers[${layer.index}].appearance`) ?? layer.appearance);
          const context = String(stageValue(`layers[${layer.index}].context`) ?? layer.context);
          if (base) post({
            type: "pick-theme-layer-image", ...base, index: layer.index, role, appearance, context,
          });
        });
        const up = document.createElement("button");
        up.type = "button";
        up.className = "ghost-button";
        up.textContent = tr("moveUp");
        up.disabled = layer.index === 0;
        up.dataset.layerBoundary = String(layer.index === 0);
        up.dataset.editorFocus = `layer-${layer.id}-move-up`;
        up.dataset.layerStructure = "";
        up.addEventListener("click", () => {
          const base = mutationBase();
          if (base) post({ type: "move-theme-layer", ...base, index: layer.index, direction: "up" });
        });
        const down = document.createElement("button");
        down.type = "button";
        down.className = "ghost-button";
        down.textContent = tr("moveDown");
        down.disabled = layer.index === state.layers.length - 1;
        down.dataset.layerBoundary = String(layer.index === state.layers.length - 1);
        down.dataset.editorFocus = `layer-${layer.id}-move-down`;
        down.dataset.layerStructure = "";
        down.addEventListener("click", () => {
          const base = mutationBase();
          if (base) post({ type: "move-theme-layer", ...base, index: layer.index, direction: "down" });
        });
        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "ghost-button danger-button";
        remove.textContent = tr("removeLayer");
        remove.dataset.editorFocus = `layer-${layer.id}-remove`;
        remove.dataset.layerStructure = "";
        remove.addEventListener("click", () => {
          const base = mutationBase();
          if (base) post({ type: "remove-theme-layer", ...base, index: layer.index });
        });
        const copyWide = document.createElement("button");
        copyWide.type = "button";
        copyWide.className = "ghost-button advanced-only";
        copyWide.textContent = tr("copyFramingToWide");
        copyWide.disabled = gated;
        copyWide.dataset.layerStateEdit = "";
        copyWide.dataset.editorFocus = `layer-${layer.id}-copy-wide`;
        copyWide.addEventListener("click", () => copyLayerFraming(layer.index, "normal", "wide"));
        const copyNormal = document.createElement("button");
        copyNormal.type = "button";
        copyNormal.className = "ghost-button advanced-only";
        copyNormal.textContent = tr("copyFramingToNormal");
        copyNormal.disabled = gated;
        copyNormal.dataset.layerStateEdit = "";
        copyNormal.dataset.editorFocus = `layer-${layer.id}-copy-normal`;
        copyNormal.addEventListener("click", () => copyLayerFraming(layer.index, "wide", "normal"));
        actions.append(replace, up, down, copyWide, copyNormal, remove);

        const sharedGrid = document.createElement("div");
        sharedGrid.className = "layer-grid";
        sharedGrid.append(
          layerSelect({ layer, property: "role", labelKey: "layerRole", quick: true, values: ROLE_IDS.map((value) => [value, `role${value[0].toUpperCase()}${value.slice(1)}`]) }),
          layerSelect({ layer, property: "appearance", labelKey: "appearanceUse", values: [["all", "appearanceAll"], ["light", "appearanceLight"], ["dark", "appearanceDark"]] }),
          layerSelect({ layer, property: "context", labelKey: "contextUse", values: [["all", "contextAll"], ["new-chat", "contextNewChat"], ["conversation", "contextConversation"]] }),
          layerSelect({ layer, property: "viewport", labelKey: "viewportUse", values: [["all", "viewportAll"], ["normal", "viewportNormal"], ["wide", "viewportWide"]] }),
          layerRange({ layer, property: "opacity", labelKey: "layerOpacity", min: 0, max: 1, step: 0.01, value: layer.opacity, display: (v) => `${Math.round(v * 100)}%` }),
          layerSelect({ layer, property: "mask", labelKey: "layerMask", values: [["none", "maskNone"], ["soft-right", "maskSoftRight"]] }),
          layerSelect({ layer, property: "mobile", labelKey: "mobileBehavior", values: [["keep", "mobileKeep"], ["reduce", "mobileReduce"], ["hide", "mobileHide"]] }),
        );
        const visible = document.createElement("label");
        visible.className = "layer-field layer-checkbox";
        const visibleInput = document.createElement("input");
        visibleInput.type = "checkbox";
        visibleInput.checked = Boolean(stageValue(`layers[${layer.index}].visible`) ?? layer.visible);
        visibleInput.dataset.editorFocus = `layer-${layer.id}-shared-visible`;
        visibleInput.dataset.editorField = `layers[${layer.index}].visible`;
        visibleInput.addEventListener("change", () => {
          setStageOverride(`layers[${layer.index}].visible`, visibleInput.checked);
          queueLayerChange(layer.index, "shared", "visible", visibleInput.checked);
          renderStage();
        });
        visible.append(visibleInput, document.createTextNode(tr("layerVisible")));
        sharedGrid.appendChild(visible);

        const placementScope = document.createElement("p");
        placementScope.className = "help layer-placement-scope";
        const appearanceScope = appearance === "all" ? tr("appearanceBoth") : appearanceLabel;
        const contextScope = context === "all" ? tr("contextBoth") : tr(contextKey);
        const scopeLabel = `${appearanceScope} · ${contextScope}`;
        placementScope.textContent = format(tr(
          appearance === "all" || context === "all" ? "layerPlacementShared" : "layerPlacementSpecific",
        ), scopeLabel);

        const meta = document.createElement("p");
        meta.className = "layer-meta advanced-only";
        meta.textContent = format(tr("imageBytes"), formatBytes(layer.bytes));
        body.append(inspectorTitle, sharedGrid, placementScope, actions,
          renderFrame(layer, "normal", gated), renderFrame(layer, "wide", gated), meta);
        card.append(cardSummary, body);
        layerList.appendChild(card);
      }
      refreshInspectorContext();
      if (focusKey) requestAnimationFrame(() => layerList.querySelector(`[data-editor-focus="${focusKey}"]`)?.focus());
    };

    const revealAdvancedForError = (field) => {
      const direct = editor.querySelector(`[data-editor-field="${CSS.escape(field)}"]`);
      if (field.startsWith("budget.") || direct?.closest(".advanced-only")) {
        editor.dataset.level = "advanced";
        for (const input of document.querySelectorAll('input[name="editor-level"]')) {
          input.checked = input.value === "advanced";
        }
      }
      const target = field.startsWith("launcher.") ? "widgets.app-identity"
        : field.startsWith("layers[") || field.startsWith("budget.layer") ? "background.layer"
          : field === "shared.backgroundScope" ? "background.canvas"
            : field.startsWith("shared.prompt.") ? "interface.new-chat-area"
              : "interface.theme";
      setInspectorTarget(target);
      if (field.startsWith("metadata.") || field.startsWith("labels.")
          || field.startsWith("descriptions.")) documentDetails.open = true;
      return direct;
    };

    const focusBelowInspector = (target) => {
      if (!target) return;
      target.focus({ preventScroll: true });
      if (!editorControls || !inspectorHead) return;
      const targetRect = target.getBoundingClientRect();
      const controlsRect = editorControls.getBoundingClientRect();
      const visibleTop = Math.max(controlsRect.top, inspectorHead.getBoundingClientRect().bottom) + 12;
      const visibleBottom = controlsRect.bottom - 12;
      const delta = targetRect.top < visibleTop
        ? targetRect.top - visibleTop
        : targetRect.bottom > visibleBottom ? targetRect.bottom - visibleBottom : 0;
      if (delta) editorControls.scrollTop += delta;
    };

    const focusError = (field) => {
      const direct = revealAdvancedForError(field);
      if (direct) {
        direct.closest("details")?.setAttribute("open", "");
        focusBelowInspector(direct);
        return;
      }
      const contrast = /^(light|dark)\.(.+)$/.exec(field);
      if (contrast) {
        selectedMode = contrast[1];
        for (const input of modeInputs) input.checked = input.value === selectedMode;
        reflectTokens();
        const token = contrast[2].includes("sidebar") ? "sidebar"
          : contrast[2].includes("surface") ? "surface"
            : contrast[2].includes("accent") || contrast[2] === "focus" ? "accent" : "text";
        const target = tokenGroups.querySelector(`[data-editor-token="${token}"]`);
        if (target?.closest(".advanced-only")) {
          editor.dataset.level = "advanced";
          for (const input of document.querySelectorAll('input[name="editor-level"]')) {
            input.checked = input.value === "advanced";
          }
        }
        setInspectorTarget("interface.theme");
        renderStage();
        target?.closest("details")?.setAttribute("open", "");
        focusBelowInspector(target);
        return;
      }
      const layer = /^layers\[(layer-[a-f0-9]{32}|\d+)]$/.exec(field);
      if (layer) {
        setInspectorTarget("background.layer");
        const card = layer[1].startsWith("layer-")
          ? layerList.querySelector(`[data-layer-id="${CSS.escape(layer[1])}"]`)
          : layerList.querySelector(`[data-editor-layer="${layer[1]}"]`);
        if (card) {
          selectedLayerId = card.dataset.layerId;
          syncSelectedLayerCards();
          card.open = true;
          focusBelowInspector(card.querySelector("summary"));
          return;
        }
      }
      focusBelowInspector(field.startsWith("budget.") ? feedbackRoot : title);
    };

    const validationMessageFor = (error) => {
      if (!error) return tr("validationGenericFix");
      if (error.field.startsWith("launcher.")) return tr("validationIdentityFix");
      if (error.code.includes("contrast") || /^(light|dark)\./.test(error.field)) return tr("validationColorFix");
      if (error.code.includes("budget") || error.field.startsWith("budget.")) return tr("validationBudgetFix");
      if (error.field.startsWith("layers[")) return tr("validationArtworkFix");
      if (error.field.startsWith("metadata.") || error.field.startsWith("labels.")
          || error.field.startsWith("descriptions.")) return tr("validationMetadataFix");
      return tr("validationGenericFix");
    };

    const renderFeedback = () => {
      feedbackRoot.replaceChildren();
      quickFeedback.replaceChildren();
      errorSummary.replaceChildren();
      errorSummary.hidden = true;
      const list = document.createElement("ul");
      list.className = "editor-feedback-list";
      const addItem = (label, value, pass) => {
        const item = document.createElement("li");
        item.className = "editor-feedback-item";
        item.dataset.pass = String(pass);
        const strong = document.createElement("strong");
        strong.textContent = label;
        const result = document.createElement("span");
        result.textContent = value;
        item.append(strong, result);
        list.appendChild(item);
      };
      addItem(state.feedback.valid ? tr("feedbackValid") : tr("feedbackInvalid"),
        state.feedback.valid ? tr("checkPass") : tr("checkFail"), state.feedback.valid);
      for (const mode of ["light", "dark"]) {
        for (const check of state.feedback.contrast[mode]) {
          addItem(format(tr("contrastCheck"), `${tr(mode === "light" ? "lightMode" : "darkMode")} ${tr(CONTRAST_LABEL_KEYS[check.id])}`),
            `${check.ratio.toFixed(2)} / ${check.minimum.toFixed(2)}`, check.pass);
        }
      }
      const budget = state.feedback.budget;
      addItem(tr("budgetChrome"), format(tr("budgetValue"), formatBytes(budget.chromeBytes), formatBytes(budget.chromeLimit)), budget.chromeBytes < budget.chromeLimit);
      addItem(tr("budgetArtwork"), format(tr("budgetValue"), formatBytes(budget.embeddedArtworkBytes), formatBytes(budget.embeddedArtworkLimit)), budget.embeddedArtworkBytes < budget.embeddedArtworkLimit);
      addItem(tr("budgetSourceArtwork"), format(tr("budgetValue"), formatBytes(budget.sourceArtworkBytes), formatBytes(budget.sourceArtworkLimit)), budget.sourceArtworkBytes < budget.sourceArtworkLimit);
      for (const layer of budget.layers) {
        addItem(`${tr("budgetLayer")} ${layer.id + 1}`, format(tr("budgetValue"), formatBytes(layer.bytes), formatBytes(layer.limit)), layer.pass);
      }
      feedbackRoot.appendChild(list);
      const quickText = document.createElement("span");
      quickText.textContent = state.feedback.valid
        ? tr("quickFeedbackValid")
        : `${format(tr("quickFeedbackInvalid"), validationMessageFor(state.feedback.errors[0]))} ${tr("studioLastValid")}`;
      quickFeedback.dataset.pass = String(state.feedback.valid);
      quickFeedback.appendChild(quickText);
      if (state.feedback.errors.length) {
        const first = state.feedback.errors[0];
        const quickJump = document.createElement("button");
        quickJump.type = "button";
        quickJump.textContent = tr("firstIssue");
        quickJump.addEventListener("click", () => focusError(first.field));
        quickFeedback.appendChild(quickJump);
        const message = document.createElement("span");
        message.textContent = validationMessageFor(first);
        const jump = document.createElement("button");
        jump.type = "button";
        jump.textContent = tr("firstIssue");
        jump.addEventListener("click", () => focusError(first.field));
        errorSummary.append(message, jump);
        errorSummary.hidden = false;
      }
    };

    const reflectButtonStates = () => {
      if (!state) return;
      reflectDirtyState();
      const busy = Boolean(pendingAction || coalescedChanges.size || changeFlushTimer
        || stageKeyTimer || stageKeyPaths.size);
      const blocked = deferredChanges.size > 0;
      undoButton.disabled = busy || blocked || !state.canUndo;
      redoButton.disabled = busy || blocked || !state.canRedo;
      resetButton.disabled = busy || blocked || !state.dirty;
      saveButton.disabled = busy
        || (state.feedback.valid && (blocked || (!state.dirty && !state.isNew)));
      // Leaving must always be possible while edits are still settling; only a
      // blocking structural action (which briefly replaces state) holds it.
      cancelButton.disabled = isBlockingAction();
      backButton.disabled = isBlockingAction();
      addLayerButton.disabled = busy || blocked || state.layers.length >= 8;
      stageOpacityInput.disabled = isBlockingAction() || blocked;
      if (replaceLauncherMarkButton) replaceLauncherMarkButton.disabled = busy || blocked;
      addLayerButton.dataset.layerStructure = "";
      for (const button of editor.querySelectorAll("[data-layer-structure]")) {
        button.disabled = busy || blocked || (button === addLayerButton && state.layers.length >= 8)
          || button.dataset.layerBoundary === "true";
      }
    };

    const reflect = (focusKey = null) => {
      if (!state) return;
      title.textContent = format(tr("editorTitleFor"), state.label);
      summary.textContent = tr("editorSummary");
      reflectDirtyState();
      validPill.textContent = state.feedback.valid ? tr("validState") : tr("invalidState");
      validPill.dataset.state = state.feedback.valid ? "valid" : "invalid";
      for (const input of modeInputs) input.checked = input.value === selectedMode;
      reflectTokens();
      reflectShared();
      reflectLauncher();
      reflectMetadata();
      renderLayers(focusKey);
      renderFeedback();
      reflectButtonStates();
      renderStage();
    };

    const settlePendingAction = (normalized) => {
      const { error: actionError } = normalized;
      if (!pendingAction || normalized.lastAction !== pendingAction) return "waiting";
      const succeeded = normalized.actionSucceeded !== false;
      if (pendingAction !== "apply-theme-patch") {
        const settledAction = pendingAction;
        setPending(null);
        if (actionError === "picker-cancelled") {
          announce(tr("editorReady"));
          return "settled";
        }
        if (!succeeded) dropStageWork();
        const successMessage = settledAction === "pick-theme-launcher-mark"
          ? tr("launcherMarkImported") : tr("editorReady");
        const failureMessage = settledAction === "pick-theme-launcher-mark"
          ? tr(actionError === "identity-apply-failed" ? "launcherMarkApplyFailed" : "launcherMarkFailed")
          : tr("editorActionFailed");
        announce(succeeded ? successMessage : failureMessage, succeeded ? "ok" : "error");
        return "settled";
      }
      if (!inFlightSession || inFlightRevision === null
          || normalized.session !== inFlightSession) {
        dropStageWork();
        setPending(null);
        announce(tr("editorActionFailed"), "error");
        return "stopped";
      }
      if (succeeded) {
        // `lastAction` remains in every subsequent host state. Only the exact
        // one-revision advance can acknowledge this patch rather than repeat
        // a previous patch result.
        if (normalized.revision !== inFlightRevision + 1) return "waiting";
        clearInFlightChanges();
        setPending(null);
        announce(tr("editorReady"));
        if (actionAfterPatch) {
          const followup = actionAfterPatch;
          actionAfterPatch = null;
          const base = mutationBase();
          const rebased = base && (Object.hasOwn(followup, "session") || Object.hasOwn(followup, "revision"))
            ? { ...followup, ...base }
            : followup;
          if (!post(rebased)) announce(tr("editorActionFailed"), "error");
        }
        return "settled";
      }
      if (actionError === "request-rejected") {
        if (normalized.revision > inFlightRevision) {
          // The host moved forward before this request arrived. Rebase once
          // against its confirmed revision; newer local values still win.
          requeueInFlightChanges();
          setPending(null);
          announce(tr("editorActionFailed"), "error");
          return "retry";
        }
        // A same-revision rejection may be permanent. Keep the local values
        // visible, stop automatic traffic, and retry only after a fresh edit.
        deferInFlightChanges();
        actionAfterPatch = null;
        setPending(null);
        announce(tr("editorActionFailed"), "error");
        return "blocked";
      }
      if (normalized.revision !== inFlightRevision + 1) return "waiting";
      // Contrast/budget failures are persisted edits, not transport failures.
      clearInFlightChanges();
      actionAfterPatch = null;
      setPending(null);
      announce(tr("editorActionFailed"), "error");
      return "settled";
    };

    const receive = (rawState, appearance = "system") => {
      const normalized = normalizeEditorState(rawState);
      if (normalized === undefined) {
        announce(tr("editorStateRejected"), "error");
        return false;
      }
      if (normalized === null || !normalized.active) {
        const wasEditing = Boolean(state) || Boolean(pendingAction);
        const action = normalized?.lastAction ?? pendingAction ?? "";
        const succeeded = normalized?.actionSucceeded !== false;
        setPending(null);
        dropStageWork();
        if (!succeeded) {
          announce(tr("editorActionFailed"), "error");
          return true;
        }
        state = null;
        onStudioStyleChange?.(null, null, null, null);
        if (wasEditing || action) hideEditor(action);
        return true;
      }
      const focusKey = document.activeElement?.dataset?.editorFocus ?? null;
      const entering = !state;
      if (entering) {
        const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)")?.matches === true;
        selectedMode = appearance === "dark" || (appearance === "system" && prefersDark) ? "dark" : "light";
        entryAppearance = appearance;
        appearanceTouched = false;
        stageContextTouched = false;
        stageMirror = null;
        stageLiveMirror = null;
        stageMirrorCache.clear();
        stageMirrorCacheBasis = null;
        previewSizeEditing = false;
        previewSizeIntent = null;
        previewExpectedRequest = null;
      }
      returnTheme = normalized.isNew ? normalized.sourceId : normalized.id;
      state = normalized;
      selectStageMirror();
      onStudioStyleChange?.(
        normalized.studioStyle,
        normalized.id,
        normalized.launcherStyle,
        normalized.launcherStylePreviewUrl,
      );
      const settlement = settlePendingAction(normalized);
      if (settlement === "waiting" && !pendingAction) setPending(null);
      showEditor();
      reflect(entering ? null : focusKey);
      if (entering) announce(tr("editorReady"));
      if (settlement !== "blocked" && settlement !== "stopped") flushThemeChanges();
      return true;
    };

    modeInputs.forEach((input) => input.addEventListener("change", () => {
      if (!input.checked) return;
      if (selectedMode !== input.value) {
        appearanceTouched = true;
        send({ type: "set-appearance", appearance: input.value });
      }
      selectedMode = input.value;
      selectStageMirror();
      reflectTokens();
      renderStage();
    }));
    document.getElementById("copy-light-dark").addEventListener("click", () => queueTokenChange("mode-copy", "tokens", "light"));
    document.getElementById("copy-dark-light").addEventListener("click", () => queueTokenChange("mode-copy", "tokens", "dark"));

    metadataInputs.forEach((input) => input.addEventListener("change", () => {
      const data = input.dataset;
      const value = input.value.trim();
      if (!value) {
        input.setAttribute("aria-invalid", "true");
        announce(tr("editorActionFailed"), "error");
        return;
      }
      input.removeAttribute("aria-invalid");
      input.value = value;
      const collection = data.editorMetadata === "label" ? "labels" : "descriptions";
      setStageOverride(`metadata.${collection}.${data.editorLocale}`, value);
      const field = data.editorMetadata;
      queueThemeChange({
        kind: "metadata",
        field,
        locale: data.editorLocale,
        value,
      });
    }));

    sharedInputs.forEach((input) => {
      const key = input.dataset.editorShared;
      const unitOutput = key === "radius" ? document.getElementById("editor-radius-output")
        : key === "blur" ? document.getElementById("editor-blur-output") : null;
      input.addEventListener("input", () => {
        if (unitOutput) unitOutput.value = `${input.value} px`;
        if (input.type === "range") {
          if (key === "radius") setInheritedRadiusPresentation(false);
          setStageOverride(input.dataset.editorField, input.valueAsNumber);
          applyStageLayout();
        }
      });
      input.addEventListener("change", () => {
        if (input.value === THEME_ORIGINAL) return;
        const value = input.type === "range" ? input.valueAsNumber : input.value;
        setStageOverride(input.dataset.editorField, value);
        applyStageLayout();
        queueTokenChange("shared", key, value);
      });
    });
    const launcherLabelKeys = Object.freeze({
      surface: "launcherSurface",
      surfaceHover: "launcherSurfaceHover",
      foreground: "launcherForeground",
      accent: "launcherAccent",
      border: "launcherBorder",
      radius: "launcherRadius",
      borderWidth: "launcherBorderWidth",
    });
    for (const input of launcherInputs) {
      const key = input.dataset.editorLauncher;
      input.setAttribute("aria-label", tr(launcherLabelKeys[key]));
      if (input.type === "color") {
        const text = launcherTextInputs.find((candidate) => candidate.dataset.editorLauncherText === key);
        if (text) text.setAttribute("aria-label", `${tr(launcherLabelKeys[key])} HEX`);
        input.addEventListener("input", () => {
          const value = input.value.toUpperCase();
          if (text) {
            text.value = value;
            text.removeAttribute("aria-invalid");
          }
          setStageOverride(`launcher.${key}`, value);
          reflectLauncher();
        });
        input.addEventListener("change", () => queueTokenChange("shared", launcherToken(key), input.value.toUpperCase()));
        text?.addEventListener("change", () => {
          const value = text.value.trim().toUpperCase();
          if (!COLOR_PATTERN.test(value)) {
            text.setAttribute("aria-invalid", "true");
            announce(tr("editorActionFailed"), "error");
            return;
          }
          text.removeAttribute("aria-invalid");
          input.value = value;
          setStageOverride(`launcher.${key}`, value);
          reflectLauncher();
          queueTokenChange("shared", launcherToken(key), value);
        });
      } else {
        input.addEventListener("input", () => {
          setStageOverride(`launcher.${key}`, input.valueAsNumber);
          reflectLauncher();
        });
        input.addEventListener("change", () => queueTokenChange("shared", launcherToken(key), input.valueAsNumber));
      }
    }
    replaceLauncherMarkButton?.addEventListener("click", () => {
      const base = editorMessageBase();
      if (base) post({ type: "pick-theme-launcher-mark", ...base });
    });
    scopeInputs.forEach((input) => input.addEventListener("change", () => {
      if (!input.checked) return;
      setStageOverride("shared.backgroundScope", input.value);
      applyStageLayout();
      queueTokenChange("shared", "backgroundScope", input.value);
    }));
    promptInputs.forEach((input) => {
      input.addEventListener("input", () => {
        if (stageContext !== "new-chat") return;
        seedNativePromptOverrides();
        document.getElementById(`${input.id}-output`).value = `${input.value}%`;
        const exact = document.getElementById(`${input.id}-exact`);
        if (exact) exact.value = input.value;
        setStageOverride(input.dataset.editorField, input.valueAsNumber / 100);
        applyStageLayout();
      });
      input.addEventListener("change", () => {
        if (stageContext !== "new-chat") return;
        commitStagePaths(STAGE_PROMPT_PATHS);
      });
    });
    promptExactInputs.forEach((exact) => {
      const key = exact.dataset.editorPromptExact;
      const range = promptInputs.find((input) => input.dataset.editorPrompt === key);
      if (!range) return;
      const labelKey = key === "width" ? "promptWidth" : key === "x" ? "horizontalOffset" : "verticalOffset";
      exact.setAttribute("aria-label", `${tr(labelKey)} · ${tr("exactValue")}`);
      const updateFromExact = () => {
        if (stageContext !== "new-chat") return null;
        if (!Number.isFinite(exact.valueAsNumber)) return null;
        seedNativePromptOverrides();
        const next = clampNumber(exact.valueAsNumber, Number(exact.min), Number(exact.max));
        exact.value = String(next);
        range.value = String(next);
        document.getElementById(`${range.id}-output`).value = `${next}%`;
        setStageOverride(range.dataset.editorField, next / 100);
        applyStageLayout();
        return next;
      };
      exact.addEventListener("input", updateFromExact);
      exact.addEventListener("change", () => {
        const next = updateFromExact();
        if (next === null) {
          exact.value = range.value;
          return;
        }
        commitStagePaths(STAGE_PROMPT_PATHS);
      });
    });

    const performUndo = () => {
      if (undoButton.disabled) return;
      const base = mutationBase();
      if (base) post({ type: "undo-theme-edit", ...base });
    };
    const performRedo = () => {
      if (redoButton.disabled) return;
      const base = mutationBase();
      if (base) post({ type: "redo-theme-edit", ...base });
    };
    const performSave = () => {
      if (saveButton.disabled) return;
      if (!state?.feedback.valid) {
        errorSummary.hidden = false;
        focusBelowInspector(errorSummary);
        announce(tr("saveBlocked"), "error");
        return;
      }
      const base = mutationBase();
      if (base) post({ type: "save-theme-edit", ...base });
    };
    undoButton.addEventListener("click", performUndo);
    redoButton.addEventListener("click", performRedo);
    resetButton.addEventListener("click", () => showConfirm({
      titleText: tr("confirmResetTitle"), bodyText: tr("confirmResetBody"), actionText: tr("confirmResetAction"),
      opener: resetButton, callback: () => state && post({ type: "begin-theme-edit", theme: state.id, reset: true }),
    }));
    saveButton.addEventListener("click", performSave);

    // Editor-wide shortcuts: Ctrl/Cmd+Z undo, Ctrl/Cmd+Y or Ctrl/Cmd+Shift+Z
    // redo, Ctrl/Cmd+S save. Skipped while a dialog is open, and undo/redo
    // yields to the browser's native text history when a text field is focused.
    document.addEventListener("keydown", (event) => {
      if (!state || editor.hidden) return;
      if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
      if (document.querySelector("dialog[open]")) return;
      const key = event.key.toLowerCase();
      if (key === "s") {
        event.preventDefault();
        performSave();
        return;
      }
      const target = event.target;
      const editingText = target instanceof HTMLElement
        && (target.isContentEditable
          || target.matches("textarea, input:not([type=color]):not([type=range]):not([type=radio]):not([type=checkbox]):not([type=button])"));
      if (editingText) return;
      if (key === "z" && !event.shiftKey) {
        event.preventDefault();
        performUndo();
      } else if (key === "y" || (key === "z" && event.shiftKey)) {
        event.preventDefault();
        performRedo();
      }
    });
    const discard = () => {
      const base = mutationBase();
      if (!base) return;
      // Cancel/Back stay live while a value patch is syncing; if that patch is
      // still in flight, post() defers the discard, so schedule it to run the
      // moment the patch settles rather than dropping it silently.
      if (!post({ type: "discard-theme-edit", ...base }) && pendingAction) {
        actionAfterPatch = { type: "discard-theme-edit", ...base };
      }
    };
    const requestExit = (opener) => {
      if (!hasUnsavedEdits()) { discard(); return; }
      showConfirm({
        titleText: tr("confirmDiscardTitle"), bodyText: tr("confirmDiscardBody"), actionText: tr("confirmDiscardAction"),
        opener, callback: discard,
      });
    };
    cancelButton.addEventListener("click", () => requestExit(cancelButton));
    backButton.addEventListener("click", () => requestExit(backButton));
    addLayerButton.addEventListener("click", () => {
      if (!state || state.layers.length >= 8) { announce(tr("layerLimit"), "error"); return; }
      const base = mutationBase();
      if (base) post({
        type: "pick-theme-layer-image",
        ...base,
        index: -1,
        role: selectedArtworkRole(),
        appearance: selectedMode,
        context: stageContext,
      });
    });

    const promptSlot = document.getElementById("prompt-builder-slot");
    const promptSubject = document.getElementById("prompt-builder-subject");
    const promptStyle = document.getElementById("prompt-builder-style");
    const promptOutput = document.getElementById("prompt-builder-output");
    const cleanPromptText = (value) => String(value || "")
      .replace(/(?:https?|file):\/\/\S+/gi, " ")
      .replace(/[A-Za-z]:\\\S*/g, " ")
      .replaceAll("\\", " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 120);
    const promptRule = (slot) => slot === "background" ? tr("promptRuleBackground")
      : slot === "hero" ? tr("promptRuleHero")
        : slot.startsWith("corner-") ? tr("promptRuleCorner")
          : slot.startsWith("card-") ? tr("promptRuleCard")
            : slot === "launcher-mark" ? tr("promptRuleLauncher") : tr("promptRuleBrand");
    const buildPrompt = () => {
      const slotOption = SLOT_OPTIONS.find(([value]) => value === promptSlot.value) ?? SLOT_OPTIONS[0];
      const subject = cleanPromptText(promptSubject.value) || tr("promptFallbackSubject");
      const style = cleanPromptText(promptStyle.value) || tr("promptFallbackStyle");
      const template = slotOption[0] === "launcher-mark" ? "launcherPromptTemplate" : "promptTemplate";
      promptOutput.value = format(tr(template), tr(slotOption[1]), subject, style, promptRule(slotOption[0]));
      announce(tr("promptBuilt"));
    };
    document.getElementById("prompt-builder-build").addEventListener("click", buildPrompt);
    document.getElementById("prompt-builder-copy").addEventListener("click", async () => {
      if (!promptOutput.value) buildPrompt();
      try {
        await navigator.clipboard.writeText(promptOutput.value);
        announce(tr("copiedPrompt"));
      } catch {
        promptOutput.focus();
        promptOutput.select();
        announce(tr("copyPromptFailed"), "error");
      }
    });

    const requestDelete = (theme, label, opener) => {
      if (!ID_PATTERN.test(theme)) return false;
      showConfirm({
        titleText: format(tr("confirmDeleteTitle"), label), bodyText: tr("confirmDeleteBody"),
        actionText: tr("confirmDeleteAction"), destructive: true, opener,
        callback: () => {
          returnTheme = "default";
          setStatus?.(tr("editorBusy"), "busy");
          send({ type: "delete-user-theme", theme });
        },
      });
      return true;
    };

    applyTranslations();
    fillSelect(document.getElementById("editor-font-ui"), FONT_UI_OPTIONS);
    fillSelect(document.getElementById("editor-font-display"), FONT_DISPLAY_OPTIONS);
    fillSelect(document.getElementById("editor-shadow"), SHADOW_OPTIONS);
    fillSelect(promptSlot, SLOT_OPTIONS);
    buildTokenControls();
    buildPrompt();
    editor.hidden = true;
    navEditor.hidden = true;

    return Object.freeze({
      receive,
      receiveMirror,
      requestDelete,
      translate: tr,
      isActive: () => Boolean(state),
      normalizeEditorState,
      normalizeStudioStyle,
      capabilityRegistry: EDITOR_CAPABILITY_REGISTRY,
    });
  }

  window.CLAUDE_AURA_EDITOR = Object.freeze({
    createController,
    normalizeEditorState,
    normalizeStudioStyle,
    normalizeCapabilityRegistry,
    capabilityRegistry: EDITOR_CAPABILITY_REGISTRY,
  });
})();
