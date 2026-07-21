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
      editAppearance: "Colors for",
      lightMode: "Light",
      darkMode: "Dark",
      copyLightToDark: "Copy Light to Dark",
      copyDarkToLight: "Copy Dark to Light",
      modeHelp: "Each appearance keeps its own colors and overlay levels.",
      colorsAndSurfaces: "Colors and surfaces",
      colorsHelp: "Use the primary controls for a quick theme, then open a group for supporting colors.",
      typographyAndMaterials: "Typography and materials",
      interfaceFont: "Interface font",
      displayFont: "Display font",
      cornerRadius: "Corner radius",
      surfaceBlur: "Surface blur",
      softShadow: "Soft shadow",
      themeBackground: "Theme background",
      backgroundScope: "Background scope",
      contentCanvas: "Content canvas",
      fullWindow: "Full window",
      contentScopeHelp: "Artwork begins after the live sidebar.",
      fullScopeHelp: "Artwork continues behind the live sidebar, which uses the selected translucent overlay.",
      artworkLayers: "Artwork layers",
      layersHelp: "Add up to eight pointer-inert images. Each layer can target an appearance, page context, and window size.",
      addLayer: "Add layer",
      promptPlacement: "New-chat prompt placement",
      promptPlacementHelp: "Move only the new-chat prompt block. Conversation composers never move.",
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
      editorSummary: "Draft changes apply to the actual Aura window after host validation.",
      savedState: "Saved",
      unsavedState: "Unsaved changes",
      validState: "Valid draft applied",
      invalidState: "Last valid draft remains active",
      editorReady: "Theme editor ready.",
      editorBusy: "Applying editor change…",
      editorStateRejected: "The editor received invalid state. Close Studio and try again.",
      editorActionFailed: "The change was not applied. Review the highlighted setting and try again.",
      saveBlocked: "Fix the validation issues before saving.",
      copiedModes: "Appearance colors copied.",
      copiedPrompt: "Prompt copied.",
      copyPromptFailed: "The prompt could not be copied. Select the text and copy it manually.",
      promptBuilt: "Prompt built locally.",
      layerLimit: "A theme can contain up to eight artwork layers.",
      noLayers: "No artwork layers yet. Add an image when the theme needs decoration.",
      layerNumber: "Layer {0}",
      layerSummary: "{0} · {1} · {2}",
      replaceImage: "Replace image",
      moveUp: "Move up",
      moveDown: "Move down",
      removeLayer: "Remove",
      layerRole: "Role",
      roleBackground: "Background",
      roleHero: "Hero",
      roleCorner: "Corner",
      roleDecoration: "Decoration",
      appearanceUse: "Appearance",
      appearanceAll: "Light and Dark",
      appearanceLight: "Light only",
      appearanceDark: "Dark only",
      contextUse: "Page context",
      contextAll: "All pages",
      contextNewChat: "New chat only",
      contextConversation: "Conversation only",
      viewportUse: "Window size",
      viewportAll: "Normal and wide",
      viewportNormal: "Normal only",
      viewportWide: "Wide/fullscreen only",
      layerVisible: "Visible",
      layerOpacity: "Opacity",
      layerMask: "Edge mask",
      maskNone: "None",
      maskSoftRight: "Soft right edge",
      mobileBehavior: "Small-window behavior",
      mobileKeep: "Keep",
      mobileReduce: "Reduce",
      mobileHide: "Hide",
      normalPreset: "Normal-window framing",
      widePreset: "Wide/fullscreen framing",
      anchor: "Anchor",
      anchorTopLeft: "Top left",
      anchorTop: "Top",
      anchorTopRight: "Top right",
      anchorLeft: "Left",
      anchorCenter: "Center",
      anchorRight: "Right",
      anchorBottomLeft: "Bottom left",
      anchorBottom: "Bottom",
      anchorBottomRight: "Bottom right",
      focalX: "Focal point X",
      focalY: "Focal point Y",
      positionX: "Position X",
      positionY: "Position Y",
      scale: "Scale",
      imageBytes: "{0} of 400 KB",
      noImagePreview: "Image",
      groupCanvas: "Canvas",
      groupSidebar: "Sidebar",
      groupSurface: "Surface",
      groupText: "Text",
      groupAccent: "Accent",
      groupBorder: "Border",
      canvasColor: "Canvas",
      sidebarColor: "Sidebar",
      surfaceColor: "Surface",
      textColor: "Primary text",
      accentColor: "Accent",
      borderColor: "Border",
      surfaceAlpha: "Content overlay",
      sidebarAlpha: "Sidebar overlay",
      fontSystemSans: "System sans",
      fontHumanistSans: "Humanist sans",
      fontRoundedSans: "Rounded sans",
      fontEditorialSerif: "Editorial serif",
      shadowNone: "None",
      shadowSoft: "Soft",
      shadowElevated: "Elevated",
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
      validationIssue: "Check {0}.",
      firstIssue: "Go to first issue",
      slotBackground: "Background",
      slotHero: "Hero",
      slotCornerTopRight: "Top-right corner",
      slotCornerBottom: "Bottom corner",
      slotCard1: "Card 1",
      slotCard2: "Card 2",
      slotCard3: "Card 3",
      slotBrandMark: "Brand mark",
      stageTitle: "Live framing stage",
      stageNotice: "The stage uses your draft's real colors and artwork, but it is not a Claude preview. Confirm in the actual Aura window.",
      stageSize: "Framing set",
      stageNormal: "Launch window",
      stageWide: "Wide/fullscreen",
      stageRealLabel: "See it in the real window",
      stageRealLaunch: "Launch size",
      stageRealWide: "Wide (≥1440)",
      stageRealFull: "Maximized",
      stageRealHelp: "Every valid draft change is already applied to the actual Aura window on live claude.ai. These buttons bring that window forward at a preset or custom size — you can also resize it freely. Launch size uses the Launch framing set; Wide and Maximized use the Wide/fullscreen set.",
      stageRealShown: "Aura window brought forward — the current draft is live there.",
      stageTopmost: "Keep on top",
      topmostOn: "The Aura window now stays on top.",
      topmostOff: "The Aura window no longer stays on top.",
      customWidth: "Width (px)",
      customHeight: "Height (px)",
      applySize: "Apply size",
      mirrorTitle: "Real window mirror",
      mirrorPrivacy: "The mirror is a scaled capture of your actual Aura window — including any conversation content. It stays on this device and is never saved to disk.",
      mirrorEmpty: "No capture yet. Open the Aura window, then refresh.",
      mirrorRefresh: "Refresh",
      mirrorCaption: "Actual Aura window · {0}×{1}",
      mirrorAlt: "Scaled capture of the actual Aura window",
      stageBackdropToggle: "Drag on the live capture",
      stageBackdropReady: "Live capture enabled — the stage now overlays the real window, and artwork appears while you drag it.",
      stageLayersPanel: "Layers",
      stageContextMismatch: "The live capture is on the other page context — this view stays schematic until the Aura window matches.",
      stageEyeToggle: "Show on stage while editing",
      stageSelectLayer: "Edit layer {0}",
      stageMoveHandle: "Move",
      editorLevel: "Editing mode",
      levelSimple: "Simple",
      levelAdvanced: "All controls",
      matrixTitle: "Every state at a glance",
      matrixHint: "Select a state to edit it.",
      hiddenInStageView: "Hidden in stage view: {0}",
      copyFramingToWide: "Copy framing → Wide/fullscreen",
      copyFramingToNormal: "Copy framing → Launch window",
      framingCopied: "Framing copied to {0}.",
      stageNewChat: "New chat",
      stageConversation: "Conversation",
      stageShowZones: "Show safe zones",
      stageKeyboardHelp: "Click or press Enter to select artwork or the prompt block. Arrow keys move it (hold Shift for larger steps); plus and minus resize artwork; bracket keys adjust prompt width. The layer-card sliders mirror every value.",
      stagePromptTag: "Prompt block",
      stageLayerAria: "Layer {0} ({1}). Arrow keys move it; plus and minus resize.",
      stagePromptAria: "New-chat prompt block. Arrow keys move it; bracket keys adjust width.",
      stageEmpty: "No artwork layers apply to this stage view.",
      stageSelectedAnnounce: "{0} selected.",
      stageScaleHandle: "Resize artwork",
      stageWidthHandle: "Adjust prompt width",
      promptTemplate: "Create a {0} theme artwork asset. Subject: {1}. Visual direction: {2}. {3} Decorative artwork only; no interface text, controls, logos, remote resources, or photographic people. Keep the composition usable when clipped at different window sizes.",
      promptFallbackSubject: "an original abstract motif",
      promptFallbackStyle: "quiet, polished, and legible behind interface content",
      promptRuleBackground: "Use a wide opaque scene with low detail through the central text-safe area.",
      promptRuleHero: "Keep the main subject inside the right 60% with clean transparent or soft-matte edges.",
      promptRuleCorner: "Use a transparent composition that remains intentional when clipped at the viewport edge.",
      promptRuleCard: "Use a square transparent composition with the subject concentrated in the bottom-right 40%.",
      promptRuleBrand: "Use a small, flat, original mark with no words or borrowed brand shapes.",
    },
    "zh-CN": {
      navEditor: "主题编辑器",
      editorKicker: "无代码主题编辑",
      historyActions: "编辑历史",
      undo: "撤销",
      redo: "重做",
      resetChanges: "重置",
      editAppearance: "编辑配色",
      lightMode: "浅色",
      darkMode: "深色",
      copyLightToDark: "复制浅色设置到深色",
      copyDarkToLight: "复制深色设置到浅色",
      modeHelp: "浅色和深色外观分别保存颜色及覆盖层透明度。",
      colorsAndSurfaces: "颜色与表面",
      colorsHelp: "可先调整主要颜色快速完成主题，再展开各组设置辅助颜色。",
      typographyAndMaterials: "字体与材质",
      interfaceFont: "界面字体",
      displayFont: "标题字体",
      cornerRadius: "圆角",
      surfaceBlur: "表面模糊",
      softShadow: "柔和阴影",
      themeBackground: "主题背景",
      backgroundScope: "背景范围",
      contentCanvas: "内容画布",
      fullWindow: "整个窗口",
      contentScopeHelp: "背景从实际侧边栏之后开始显示。",
      fullScopeHelp: "背景延伸至实际侧边栏后方，侧边栏使用所选的半透明覆盖层。",
      artworkLayers: "图片图层",
      layersHelp: "最多添加八个不响应指针操作的图片图层，并分别设置外观、页面场景及窗口尺寸。",
      addLayer: "添加图层",
      promptPlacement: "新对话提示区域位置",
      promptPlacementHelp: "仅移动新对话页面的提示区域，不会移动对话中的输入框。",
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
      editorSummary: "草稿通过主机校验后，会应用到实际 Aura 窗口。",
      savedState: "已保存",
      unsavedState: "有未保存的更改",
      validState: "有效草稿已应用",
      invalidState: "当前仍应用上一个有效草稿",
      editorReady: "主题编辑器已就绪。",
      editorBusy: "正在应用编辑内容…",
      editorStateRejected: "编辑器收到的状态无效。请关闭工作室后重试。",
      editorActionFailed: "更改未应用。请检查标记的设置后重试。",
      saveBlocked: "请先修正校验问题再保存。",
      copiedModes: "外观配色已复制。",
      copiedPrompt: "提示词已复制。",
      copyPromptFailed: "无法复制提示词。请选中文本后手动复制。",
      promptBuilt: "提示词已在本地生成。",
      layerLimit: "一个主题最多包含八个图片图层。",
      noLayers: "暂无图片图层。需要装饰时可添加图片。",
      layerNumber: "图层 {0}",
      layerSummary: "{0} · {1} · {2}",
      replaceImage: "替换图片",
      moveUp: "上移",
      moveDown: "下移",
      removeLayer: "移除",
      layerRole: "用途",
      roleBackground: "背景",
      roleHero: "主视觉",
      roleCorner: "角落装饰",
      roleDecoration: "装饰",
      appearanceUse: "适用外观",
      appearanceAll: "浅色和深色",
      appearanceLight: "仅浅色",
      appearanceDark: "仅深色",
      contextUse: "页面场景",
      contextAll: "所有页面",
      contextNewChat: "仅新对话",
      contextConversation: "仅对话页面",
      viewportUse: "窗口尺寸",
      viewportAll: "普通和宽屏",
      viewportNormal: "仅普通窗口",
      viewportWide: "仅宽屏或全屏",
      layerVisible: "显示图层",
      layerOpacity: "不透明度",
      layerMask: "边缘遮罩",
      maskNone: "无",
      maskSoftRight: "柔化右边缘",
      mobileBehavior: "小窗口显示方式",
      mobileKeep: "保持",
      mobileReduce: "缩小",
      mobileHide: "隐藏",
      normalPreset: "普通窗口构图",
      widePreset: "宽屏或全屏构图",
      anchor: "锚点",
      anchorTopLeft: "左上",
      anchorTop: "上方",
      anchorTopRight: "右上",
      anchorLeft: "左侧",
      anchorCenter: "居中",
      anchorRight: "右侧",
      anchorBottomLeft: "左下",
      anchorBottom: "下方",
      anchorBottomRight: "右下",
      focalX: "水平焦点",
      focalY: "垂直焦点",
      positionX: "水平位置",
      positionY: "垂直位置",
      scale: "缩放",
      imageBytes: "{0} / 400 KB",
      noImagePreview: "图片",
      groupCanvas: "画布",
      groupSidebar: "侧边栏",
      groupSurface: "表面",
      groupText: "文字",
      groupAccent: "强调色",
      groupBorder: "边框",
      canvasColor: "画布",
      sidebarColor: "侧边栏",
      surfaceColor: "表面",
      textColor: "主要文字",
      accentColor: "强调色",
      borderColor: "边框",
      surfaceAlpha: "内容覆盖层",
      sidebarAlpha: "侧边栏覆盖层",
      fontSystemSans: "系统无衬线字体",
      fontHumanistSans: "人文无衬线字体",
      fontRoundedSans: "圆体无衬线字体",
      fontEditorialSerif: "编辑风衬线字体",
      shadowNone: "无",
      shadowSoft: "柔和",
      shadowElevated: "悬浮",
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
      validationIssue: "请检查{0}。",
      firstIssue: "转到第一个问题",
      slotBackground: "背景",
      slotHero: "主视觉",
      slotCornerTopRight: "右上角",
      slotCornerBottom: "底部角落",
      slotCard1: "卡片 1",
      slotCard2: "卡片 2",
      slotCard3: "卡片 3",
      slotBrandMark: "品牌标记",
      stageTitle: "实时构图画布",
      stageNotice: "画布会使用草稿的真实颜色与图片，但不是 Claude 预览。请以实际 Aura 窗口为准。",
      stageSize: "构图预设",
      stageNormal: "启动窗口",
      stageWide: "宽屏或全屏",
      stageRealLabel: "在实际窗口中查看",
      stageRealLaunch: "启动尺寸",
      stageRealWide: "宽屏（≥1440）",
      stageRealFull: "最大化",
      stageRealHelp: "每次通过校验的草稿更改都会立即应用到实际的 Aura 窗口（真实 claude.ai 页面）。这些按钮会以预设或自定义尺寸调出该窗口，也可以随意拖动调整窗口大小。启动尺寸对应“启动窗口”构图预设；宽屏和最大化对应“宽屏或全屏”构图预设。",
      stageRealShown: "已调出 Aura 窗口，当前草稿已在其中生效。",
      stageTopmost: "保持置顶",
      topmostOn: "Aura 窗口已保持置顶。",
      topmostOff: "Aura 窗口已取消置顶。",
      customWidth: "宽度（px）",
      customHeight: "高度（px）",
      applySize: "应用尺寸",
      mirrorTitle: "实际窗口镜像",
      mirrorPrivacy: "镜像是实际 Aura 窗口的缩放截取画面，包含其中的对话内容。它只保留在本机，不会保存到磁盘。",
      mirrorEmpty: "暂无画面。请先打开 Aura 窗口，再点击刷新。",
      mirrorRefresh: "刷新",
      mirrorCaption: "实际 Aura 窗口 · {0}×{1}",
      mirrorAlt: "实际 Aura 窗口的缩放画面",
      stageBackdropToggle: "在实时画面上拖动",
      stageBackdropReady: "已启用实时画面背景：画布现在叠加在实际窗口画面上，拖动图片时会显示半透明预览。",
      stageLayersPanel: "图层",
      stageContextMismatch: "实时画面当前处于另一个页面场景，在 Aura 窗口切换到该场景之前，此视图会以示意图显示。",
      stageEyeToggle: "编辑时在画布中显示",
      stageSelectLayer: "编辑图层 {0}",
      stageMoveHandle: "移动",
      editorLevel: "编辑模式",
      levelSimple: "简易",
      levelAdvanced: "全部控件",
      matrixTitle: "全部状态一览",
      matrixHint: "点击某个状态即可编辑。",
      hiddenInStageView: "当前画布视图中隐藏：{0}",
      copyFramingToWide: "复制构图 → 宽屏或全屏",
      copyFramingToNormal: "复制构图 → 启动窗口",
      framingCopied: "构图已复制到{0}。",
      stageNewChat: "新对话",
      stageConversation: "对话页面",
      stageShowZones: "显示安全区域",
      stageKeyboardHelp: "点击或按回车键选中图片或提示区域后，可用方向键移动（按住 Shift 幅度更大）；加号和减号缩放图片，中括号键调整提示区域宽度。图层卡片中的滑块会与画布数值保持同步。",
      stagePromptTag: "提示区域",
      stageLayerAria: "图层 {0}（{1}）。使用方向键移动，加号和减号缩放。",
      stagePromptAria: "新对话提示区域。使用方向键移动，中括号键调整宽度。",
      stageEmpty: "当前画布视图没有适用的图片图层。",
      stageSelectedAnnounce: "已选中{0}。",
      stageScaleHandle: "缩放图片",
      stageWidthHandle: "调整提示区域宽度",
      promptTemplate: "创建一个{0}主题图片素材。主体：{1}。视觉方向：{2}。{3} 图片仅用于装饰；不得包含界面文字、控件、标识、远程资源或真实人物照片。请确保构图在不同窗口尺寸下裁切后仍可使用。",
      promptFallbackSubject: "原创抽象图案",
      promptFallbackStyle: "安静、精致，并确保界面内容清晰可读",
      promptRuleBackground: "使用宽幅不透明场景，中央文字安全区域保持低细节。",
      promptRuleHero: "将主要主体放在右侧 60% 范围内，并使用干净的透明边缘或柔和衬底。",
      promptRuleCorner: "使用透明构图，确保在视口边缘裁切后仍然完整自然。",
      promptRuleCard: "使用方形透明构图，主体集中在右下方 40% 范围内。",
      promptRuleBrand: "使用不含文字及他人品牌造型的小型原创平面标记。",
    },
    "zh-TW": {
      navEditor: "主題編輯器",
      editorKicker: "不用寫程式也能編輯主題",
      historyActions: "編輯記錄",
      undo: "復原",
      redo: "重做",
      resetChanges: "重設",
      editAppearance: "編輯配色",
      lightMode: "淺色",
      darkMode: "深色",
      copyLightToDark: "將淺色設定複製到深色",
      copyDarkToLight: "將深色設定複製到淺色",
      modeHelp: "淺色與深色外觀會分別儲存顏色和覆蓋層透明度。",
      colorsAndSurfaces: "顏色與表面",
      colorsHelp: "可先調整主要顏色快速完成主題，再展開各組設定輔助顏色。",
      typographyAndMaterials: "字體與材質",
      interfaceFont: "介面字體",
      displayFont: "標題字體",
      cornerRadius: "圓角",
      surfaceBlur: "表面模糊",
      softShadow: "柔和陰影",
      themeBackground: "主題背景",
      backgroundScope: "背景範圍",
      contentCanvas: "內容畫布",
      fullWindow: "整個視窗",
      contentScopeHelp: "背景會從實際側邊欄後方開始顯示。",
      fullScopeHelp: "背景會延伸到實際側邊欄後方，側邊欄則套用所選的半透明覆蓋層。",
      artworkLayers: "圖片圖層",
      layersHelp: "最多可新增八個不會接收指標操作的圖片圖層，並分別設定外觀、頁面情境和視窗大小。",
      addLayer: "新增圖層",
      promptPlacement: "新對話提示區塊位置",
      promptPlacementHelp: "只會移動新對話頁面的提示區塊，不會移動對話中的輸入框。",
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
      editorSummary: "草稿通過主程式檢查後，會套用到實際的 Aura 視窗。",
      savedState: "已儲存",
      unsavedState: "有尚未儲存的變更",
      validState: "有效草稿已套用",
      invalidState: "目前仍套用上一個有效草稿",
      editorReady: "主題編輯器已準備好。",
      editorBusy: "正在套用編輯內容…",
      editorStateRejected: "編輯器收到的狀態無效。請關閉工作室後再試一次。",
      editorActionFailed: "變更未套用。請檢查標示的設定後再試一次。",
      saveBlocked: "請先修正檢查問題，再儲存主題。",
      copiedModes: "外觀配色已複製。",
      copiedPrompt: "提示詞已複製。",
      copyPromptFailed: "無法複製提示詞。請選取文字後手動複製。",
      promptBuilt: "提示詞已在本機產生。",
      layerLimit: "一個主題最多可放八個圖片圖層。",
      noLayers: "目前沒有圖片圖層。需要裝飾時再新增圖片即可。",
      layerNumber: "圖層 {0}",
      layerSummary: "{0} · {1} · {2}",
      replaceImage: "更換圖片",
      moveUp: "上移",
      moveDown: "下移",
      removeLayer: "移除",
      layerRole: "用途",
      roleBackground: "背景",
      roleHero: "主視覺",
      roleCorner: "角落裝飾",
      roleDecoration: "裝飾",
      appearanceUse: "適用外觀",
      appearanceAll: "淺色和深色",
      appearanceLight: "只用於淺色",
      appearanceDark: "只用於深色",
      contextUse: "頁面情境",
      contextAll: "所有頁面",
      contextNewChat: "只用於新對話",
      contextConversation: "只用於對話頁面",
      viewportUse: "視窗大小",
      viewportAll: "一般和寬螢幕",
      viewportNormal: "只用於一般視窗",
      viewportWide: "只用於寬螢幕或全螢幕",
      layerVisible: "顯示圖層",
      layerOpacity: "不透明度",
      layerMask: "邊緣遮罩",
      maskNone: "無",
      maskSoftRight: "柔化右側邊緣",
      mobileBehavior: "小視窗顯示方式",
      mobileKeep: "保留",
      mobileReduce: "縮小",
      mobileHide: "隱藏",
      normalPreset: "一般視窗構圖",
      widePreset: "寬螢幕或全螢幕構圖",
      anchor: "錨點",
      anchorTopLeft: "左上",
      anchorTop: "上方",
      anchorTopRight: "右上",
      anchorLeft: "左側",
      anchorCenter: "置中",
      anchorRight: "右側",
      anchorBottomLeft: "左下",
      anchorBottom: "下方",
      anchorBottomRight: "右下",
      focalX: "水平焦點",
      focalY: "垂直焦點",
      positionX: "水平位置",
      positionY: "垂直位置",
      scale: "縮放",
      imageBytes: "{0} / 400 KB",
      noImagePreview: "圖片",
      groupCanvas: "畫布",
      groupSidebar: "側邊欄",
      groupSurface: "表面",
      groupText: "文字",
      groupAccent: "強調色",
      groupBorder: "邊框",
      canvasColor: "畫布",
      sidebarColor: "側邊欄",
      surfaceColor: "表面",
      textColor: "主要文字",
      accentColor: "強調色",
      borderColor: "邊框",
      surfaceAlpha: "內容覆蓋層",
      sidebarAlpha: "側邊欄覆蓋層",
      fontSystemSans: "系統無襯線字體",
      fontHumanistSans: "人文無襯線字體",
      fontRoundedSans: "圓體無襯線字體",
      fontEditorialSerif: "編輯風襯線字體",
      shadowNone: "無",
      shadowSoft: "柔和",
      shadowElevated: "浮起",
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
      validationIssue: "請檢查{0}。",
      firstIssue: "前往第一個問題",
      slotBackground: "背景",
      slotHero: "主視覺",
      slotCornerTopRight: "右上角",
      slotCornerBottom: "底部角落",
      slotCard1: "卡片 1",
      slotCard2: "卡片 2",
      slotCard3: "卡片 3",
      slotBrandMark: "品牌標記",
      stageTitle: "即時構圖畫布",
      stageNotice: "畫布會套用草稿的實際顏色和圖片，但不是 Claude 預覽，請以實際的 Aura 視窗為準。",
      stageSize: "構圖預設",
      stageNormal: "啟動視窗",
      stageWide: "寬螢幕或全螢幕",
      stageRealLabel: "在實際視窗中檢視",
      stageRealLaunch: "啟動大小",
      stageRealWide: "寬螢幕（≥1440）",
      stageRealFull: "最大化",
      stageRealHelp: "每次通過檢查的草稿變更都會立刻套用到實際的 Aura 視窗（真實的 claude.ai 頁面）。這些按鈕會以預設或自訂大小帶出該視窗，也可以自由拖曳調整視窗大小。啟動大小對應「啟動視窗」構圖預設；寬螢幕和最大化對應「寬螢幕或全螢幕」構圖預設。",
      stageRealShown: "已帶出 Aura 視窗，目前的草稿已在裡面生效。",
      stageTopmost: "維持最上層",
      topmostOn: "Aura 視窗已維持在最上層。",
      topmostOff: "Aura 視窗已取消最上層。",
      customWidth: "寬度（px）",
      customHeight: "高度（px）",
      applySize: "套用大小",
      mirrorTitle: "實際視窗鏡像",
      mirrorPrivacy: "鏡像是實際 Aura 視窗的縮放擷取畫面，會包含裡面的對話內容。它只會留在這台裝置上，不會儲存到磁碟。",
      mirrorEmpty: "還沒有畫面。請先開啟 Aura 視窗，再按重新整理。",
      mirrorRefresh: "重新整理",
      mirrorCaption: "實際 Aura 視窗 · {0}×{1}",
      mirrorAlt: "實際 Aura 視窗的縮放畫面",
      stageBackdropToggle: "在即時畫面上拖曳",
      stageBackdropReady: "已啟用即時畫面背景：畫布現在會疊在實際視窗畫面上，拖曳圖片時會顯示半透明預覽。",
      stageLayersPanel: "圖層",
      stageContextMismatch: "即時畫面目前在另一個頁面情境，在 Aura 視窗切換到該情境之前，這個檢視會以示意圖顯示。",
      stageEyeToggle: "編輯時在畫布中顯示",
      stageSelectLayer: "編輯圖層 {0}",
      stageMoveHandle: "移動",
      editorLevel: "編輯模式",
      levelSimple: "簡易",
      levelAdvanced: "所有控制項",
      matrixTitle: "所有狀態一覽",
      matrixHint: "點選某個狀態即可編輯。",
      hiddenInStageView: "目前畫布檢視中隱藏：{0}",
      copyFramingToWide: "複製構圖 → 寬螢幕或全螢幕",
      copyFramingToNormal: "複製構圖 → 啟動視窗",
      framingCopied: "構圖已複製到{0}。",
      stageNewChat: "新對話",
      stageConversation: "對話頁面",
      stageShowZones: "顯示安全區域",
      stageKeyboardHelp: "點一下或按 Enter 選取圖片或提示區塊後，可用方向鍵移動（按住 Shift 幅度更大）；加號和減號可縮放圖片，中括號鍵可調整提示區塊寬度。圖層卡片裡的滑桿會和畫布數值同步。",
      stagePromptTag: "提示區塊",
      stageLayerAria: "圖層 {0}（{1}）。用方向鍵移動，加號和減號縮放。",
      stagePromptAria: "新對話提示區塊。用方向鍵移動，中括號鍵調整寬度。",
      stageEmpty: "目前這個畫布檢視沒有適用的圖片圖層。",
      stageSelectedAnnounce: "已選取{0}。",
      stageScaleHandle: "縮放圖片",
      stageWidthHandle: "調整提示區塊寬度",
      promptTemplate: "建立一張{0}主題圖片素材。主體：{1}。視覺方向：{2}。{3} 圖片只作裝飾；不要放入介面文字、控制項、標誌、遠端資源或真實人物照片。請讓構圖在不同視窗大小下裁切後仍可使用。",
      promptFallbackSubject: "原創抽象圖案",
      promptFallbackStyle: "安靜、精緻，並讓介面內容保持清楚易讀",
      promptRuleBackground: "使用寬幅不透明場景，中央文字安全區域保持低細節。",
      promptRuleHero: "將主要主體放在右側 60% 範圍內，並使用乾淨的透明邊緣或柔和襯底。",
      promptRuleCorner: "使用透明構圖，讓圖片在視窗邊緣裁切後仍然自然完整。",
      promptRuleCard: "使用方形透明構圖，主體集中在右下方 40% 範圍內。",
      promptRuleBrand: "使用不含文字或他人品牌造型的小型原創平面標記。",
    },
  };

  const ID_PATTERN = /^[a-z][a-z0-9-]{1,39}$/;
  const SESSION_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
  const COLOR_PATTERN = /^#[0-9A-F]{6}$/;
  const PREVIEW_PATH_PATTERN = /^\/active\/(?:[a-z0-9][a-z0-9-]{0,63}\/)*[a-z0-9][a-z0-9-]{0,80}\.webp$/;
  const ACTIONS = new Set([
    "create-theme-copy", "begin-theme-edit", "set-theme-token", "set-theme-layer",
    "pick-theme-layer-image", "remove-theme-layer", "move-theme-layer", "undo-theme-edit",
    "redo-theme-edit", "save-theme-edit", "discard-theme-edit", "delete-user-theme",
  ]);
  const MODE_TOKEN_KEYS = Object.freeze([
    "canvas", "sidebar", "surface", "text", "accent", "border", "surfaceAlpha", "sidebarAlpha",
  ]);
  const COLOR_TOKEN_KEYS = new Set(MODE_TOKEN_KEYS.slice(0, 6));
  const FONT_UI_IDS = Object.freeze(["system-sans", "humanist-sans", "rounded-sans"]);
  const FONT_DISPLAY_IDS = Object.freeze([...FONT_UI_IDS, "editorial-serif"]);
  const SHADOW_IDS = Object.freeze(["none", "soft", "elevated"]);
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
    ["brand-mark", "slotBrandMark"],
  ]);

  // Stage geometry mirrors assets/renderer-inject.js: wide begins at 1440px
  // windows, anchors are container percentage points, and framed images keep
  // their natural pixel size inside a uniformly scaled logical canvas. The
  // logical sizes equal the host's set-aura-preview client sizes so the stage
  // and the real Aura window show the same geometry.
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
    const keys = ["fontUi", "fontDisplay", "radius", "blur", "shadow", "backgroundScope", "prompt"];
    if (!exactShape(value, keys) || !exactShape(value.prompt, ["width", "x", "y"])) return null;
    if (!enumValue(value.fontUi, FONT_UI_IDS) || !enumValue(value.fontDisplay, FONT_DISPLAY_IDS)
        || !inRange(value.radius, 0, 32) || !inRange(value.blur, 0, 40)
        || !enumValue(value.shadow, SHADOW_IDS) || !enumValue(value.backgroundScope, ["content", "full-window"])
        || !inRange(value.prompt.width, 0.4, 0.96) || !inRange(value.prompt.x, -0.35, 0.35)
        || !inRange(value.prompt.y, -0.3, 0.3)) return null;
    return {
      fontUi: value.fontUi,
      fontDisplay: value.fontDisplay,
      radius: value.radius,
      blur: value.blur,
      shadow: value.shadow,
      backgroundScope: value.backgroundScope,
      prompt: { width: value.prompt.width, x: value.prompt.x, y: value.prompt.y },
    };
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
      "index", "role", "appearance", "context", "viewport", "visible", "opacity", "mask", "mobile",
      "bytes", "previewUrl", "frames",
    ];
    if (!exactShape(value, keys) || value.index !== expectedIndex || !integer(value.index, 0, 7)
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
      "label", "tokens", "shared", "layers", "feedback",
    ];
    if (!exactShape(value, required, optional) || !ID_PATTERN.test(value.id)
        || !ID_PATTERN.test(value.sourceId) || !enumValue(value.source, ["user", "builtin"])
        || typeof value.isNew !== "boolean" || typeof value.session !== "string" || !SESSION_PATTERN.test(value.session)
        || !integer(value.revision, 0, Number.MAX_SAFE_INTEGER) || typeof value.dirty !== "boolean"
        || typeof value.canUndo !== "boolean" || typeof value.canRedo !== "boolean") return undefined;
    const label = safeText(value.label, 120);
    if (!label || !exactShape(value.tokens, ["light", "dark"])) return undefined;
    const light = normalizeModeTokens(value.tokens.light);
    const dark = normalizeModeTokens(value.tokens.dark);
    const shared = normalizeShared(value.shared);
    if (!light || !dark || !shared || !Array.isArray(value.layers) || value.layers.length > 8) return undefined;
    const layers = value.layers.map(normalizeLayer);
    const feedback = normalizeFeedback(value.feedback);
    if (layers.some((layer) => !layer) || !feedback) return undefined;
    if (value.lastAction !== undefined && !ACTIONS.has(value.lastAction)) return undefined;
    if (value.actionSucceeded !== undefined && typeof value.actionSucceeded !== "boolean") return undefined;
    if (value.error !== undefined && value.error !== null && !safeText(value.error, 500)) return undefined;
    return {
      ...value,
      label,
      tokens: { light, dark },
      shared,
      layers,
      feedback,
    };
  }

  function createController({ locale, send, setStatus, translate, focusThemeCard }) {
    const normalizedLocale = Object.hasOwn(STRINGS, locale) ? locale : "en";
    const tr = (key) => STRINGS[normalizedLocale][key] ?? translate?.(key) ?? STRINGS.en[key] ?? key;
    const editor = document.getElementById("editor");
    const navEditor = document.getElementById("nav-editor");
    const ordinarySections = ["themes", "background", "create"].map((id) => document.getElementById(id));
    const ordinaryLinks = [...document.querySelectorAll(".rail-item")].filter((link) => link !== navEditor);
    const content = document.querySelector(".content");
    const title = document.getElementById("editor-title");
    const summary = document.getElementById("editor-summary");
    const dirtyPill = document.getElementById("editor-dirty");
    const validPill = document.getElementById("editor-valid");
    const live = document.getElementById("editor-live");
    const errorSummary = document.getElementById("editor-error-summary");
    const tokenGroups = document.getElementById("editor-token-groups");
    const layerList = document.getElementById("editor-layer-list");
    const feedbackRoot = document.getElementById("editor-feedback");
    const confirmDialog = document.getElementById("editor-confirm-dialog");
    const confirmTitle = document.getElementById("editor-confirm-title");
    const confirmBody = document.getElementById("editor-confirm-body");
    const confirmAction = document.getElementById("editor-confirm-action");
    const modeInputs = [...document.querySelectorAll('input[name="editor-mode"]')];
    const scopeInputs = [...document.querySelectorAll('input[name="background-scope"]')];
    const sharedInputs = [...document.querySelectorAll("[data-editor-shared]")];
    const promptInputs = [...document.querySelectorAll("[data-editor-prompt]")];
    const saveButton = document.getElementById("editor-save");
    const cancelButton = document.getElementById("editor-cancel");
    const undoButton = document.getElementById("editor-undo");
    const redoButton = document.getElementById("editor-redo");
    const resetButton = document.getElementById("editor-reset");
    const addLayerButton = document.getElementById("editor-add-layer");
    let state = null;
    let selectedMode = "light";
    let pendingAction = null;
    let returnTheme = "default";
    let confirmCallback = null;
    let confirmReturnFocus = null;
    let firstOpen = true;
    let entryAppearance = null;
    let appearanceTouched = false;

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

    const setPending = (action = null) => {
      pendingAction = action;
      editor.setAttribute("aria-busy", String(Boolean(action)));
      for (const button of editor.querySelectorAll("button")) button.disabled = Boolean(action);
      reflectButtonStates();
    };

    const post = (message) => {
      if (pendingAction || !send(message)) return false;
      setPending(message.type);
      announce(tr("editorBusy"), "busy");
      return true;
    };

    const mutationBase = () => state ? { session: state.session, revision: state.revision } : null;
    const postToken = (mode, token, value) => {
      const base = mutationBase();
      if (base) post({ type: "set-theme-token", ...base, mode, token, value });
    };
    const postLayer = (index, preset, property, value) => {
      const base = mutationBase();
      if (base) post({ type: "set-theme-layer", ...base, index, preset, property, value });
    };

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

    const showEditor = () => {
      for (const section of ordinarySections) section.hidden = true;
      editor.hidden = false;
      setCurrentNavigation(true);
      if (firstOpen) {
        content.scrollTop = 0;
        requestAnimationFrame(() => {
          title.focus();
          applyStageLayout();
        });
        firstOpen = false;
      }
    };

    const hideEditor = (action = "") => {
      editor.hidden = true;
      for (const section of ordinarySections) section.hidden = false;
      setCurrentNavigation(false);
      firstOpen = true;
      dropStageWork();
      stageSelection = null;
      stageHiddenLayers.clear();
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
    const stageRoot = document.getElementById("editor-stage");
    const stageViewportInputs = [...document.querySelectorAll('input[name="stage-viewport"]')];
    const stageContextInputs = [...document.querySelectorAll('input[name="stage-context"]')];
    const stageZonesInput = document.getElementById("stage-zones");
    let stageViewport = "normal";
    let stageContext = "new-chat";
    let stageDrag = null;
    let stageSelection = null;
    let stageKeyTimer = null;
    let mutationQueue = [];
    let stageMirror = null;
    // Drag pointermove is coalesced into one animation frame so a 120 Hz
    // pointer stream produces at most one layout pass per displayed frame.
    let stageDragFrame = 0;
    let stageDragEvent = null;
    const stageOverrides = new Map();
    const stageLayerNodes = new Map();
    // Memoized lookups of the range inputs mirrored during a drag; nodes are
    // re-resolved automatically once a layer-card rebuild disconnects them.
    const stageInputCache = new Map();
    const clampNumber = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));
    const backdropToggleInput = document.getElementById("stage-backdrop");
    // With a live capture as backdrop, the stage adopts the real window's
    // exact dimensions so drags map 1:1 onto the real pixels. When the user
    // edits a page context the real window is not showing, that view falls
    // back to the schematic so the toggle always produces a visible change.
    const stageBackdropOn = () => Boolean(backdropToggleInput?.checked && stageMirror
      && (!stageMirror.geometry || stageMirror.geometry.context === "other"
        || stageMirror.geometry.context === stageContext));
    const stageLogicalSize = () => stageBackdropOn()
      ? [stageMirror.width, stageMirror.height]
      : STAGE_SIZES[stageViewport];
    const stageMainMetrics = (logicalWidth, logicalHeight) => {
      const geometryMain = stageBackdropOn() ? stageMirror?.geometry?.main : null;
      if (geometryMain && geometryMain.width > 100) {
        return { left: geometryMain.left, width: geometryMain.width, height: logicalHeight };
      }
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
    const stageValue = (path) => stageOverrides.has(path) ? stageOverrides.get(path) : statePath(path);
    const setStageOverride = (path, value) => { if (path) stageOverrides.set(path, value); };
    const dropStageWork = () => {
      mutationQueue = [];
      stageOverrides.clear();
      stageDrag = null;
      stageDragEvent = null;
      if (stageDragFrame) { cancelAnimationFrame(stageDragFrame); stageDragFrame = 0; }
      if (stageKeyTimer) { clearTimeout(stageKeyTimer); stageKeyTimer = null; }
    };

    const pumpMutationQueue = () => {
      if (pendingAction || !mutationQueue.length) return;
      const next = mutationQueue.shift();
      const base = mutationBase();
      if (!base || !post({ ...next, ...base })) mutationQueue = [];
    };
    const queueStageMutations = (messages) => {
      mutationQueue.push(...messages);
      pumpMutationQueue();
    };

    const messageForStagePath = (path, value) => {
      const layer = /^layers\[(\d+)]\.frames\.(normal|wide)\.(positionX|positionY|scale)$/.exec(path);
      if (layer) {
        const rounded = layer[3] === "scale" ? Math.round(value * 100) / 100 : Math.round(value);
        return { type: "set-theme-layer", index: Number(layer[1]), preset: layer[2], property: layer[3], value: rounded };
      }
      const prompt = /^shared\.prompt\.(width|x|y)$/.exec(path);
      if (prompt) {
        return { type: "set-theme-token", mode: "shared", token: STAGE_PROMPT_TOKENS[prompt[1]], value: Math.round(value * 100) / 100 };
      }
      return null;
    };
    const stageItemPaths = (selection) => {
      if (!selection) return [];
      if (selection.kind === "prompt") return ["shared.prompt.x", "shared.prompt.y", "shared.prompt.width"];
      return STAGE_LAYER_PATHS.map((property) => `layers[${selection.index}].frames.${stageViewport}.${property}`);
    };
    const commitStagePaths = (paths) => {
      const messages = [];
      for (const path of paths) {
        if (!stageOverrides.has(path)) continue;
        const value = stageOverrides.get(path);
        const saved = statePath(path);
        if (typeof value === "number" && typeof saved === "number" && Math.abs(value - saved) < 0.0005) continue;
        const message = messageForStagePath(path, value);
        if (message) messages.push(message);
      }
      if (messages.length) queueStageMutations(messages);
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
      if (stageSelection?.kind !== "layer") return;
      setStageOverride(`layers[${stageSelection.index}].opacity`, stageOpacityInput.valueAsNumber / 100);
      applyStageLayout();
    });
    stageOpacityInput.addEventListener("change", () => {
      if (stageSelection?.kind !== "layer") return;
      queueStageMutations([{
        type: "set-theme-layer",
        index: stageSelection.index,
        preset: "shared",
        property: "opacity",
        value: stageOpacityInput.valueAsNumber / 100,
      }]);
    });
    // Procreate-style floating dialog: rows select the active layer, eyes hide
    // a layer on the stage only (session-local, never written to the draft),
    // arrows reorder through the validated move action, and the whole dialog
    // collapses out of the way.
    const stageLayersPanel = document.createElement("div");
    stageLayersPanel.className = "stage-layers-panel";
    stageLayersPanel.setAttribute("role", "group");
    stageLayersPanel.dataset.editorI18nAriaLabel = "stageLayersPanel";
    stageLayersPanel.setAttribute("aria-label", "Layers");
    stageLayersPanel.dataset.collapsed = "false";
    const stageLayersHead = document.createElement("button");
    stageLayersHead.type = "button";
    stageLayersHead.className = "stage-layers-head";
    stageLayersHead.setAttribute("aria-expanded", "true");
    const stageLayersList = document.createElement("div");
    stageLayersList.className = "stage-layers-list";
    const stageLayersAdd = document.createElement("button");
    stageLayersAdd.type = "button";
    stageLayersAdd.className = "ghost-button stage-layers-add";
    stageLayersAdd.textContent = tr("addLayer");
    stageLayersAdd.dataset.editorI18n = "addLayer";
    stageLayersPanel.append(stageLayersHead, stageLayersList, stageLayersAdd);
    stageLayersHead.addEventListener("click", () => {
      const collapsed = stageLayersPanel.dataset.collapsed === "true";
      stageLayersPanel.dataset.collapsed = String(!collapsed);
      stageLayersHead.setAttribute("aria-expanded", String(collapsed));
    });
    stageLayersAdd.addEventListener("click", () => {
      if (!state || state.layers.length >= 8) {
        announce(tr("layerLimit"), "error");
        return;
      }
      const base = mutationBase();
      if (base) post({ type: "pick-theme-layer-image", ...base, index: -1, role: "decoration" });
    });
    const stageHiddenLayers = new Set();
    const stageEmptyNote = document.createElement("p");
    stageEmptyNote.className = "stage-empty";
    stageEmptyNote.hidden = true;
    const stagePromptEl = document.createElement("div");
    stagePromptEl.className = "stage-prompt";
    stagePromptEl.dataset.stageItem = "prompt";
    stagePromptEl.dataset.editorFocus = "stage-prompt";
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
    stageContextHint.dataset.editorI18n = "stageContextMismatch";
    stageContextHint.textContent = tr("stageContextMismatch");
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

    const syncStageToolbar = () => {
      for (const input of stageViewportInputs) input.checked = input.value === stageViewport;
      for (const input of stageContextInputs) input.checked = input.value === stageContext;
      if (stageZonesInput) stageRoot.dataset.zones = String(stageZonesInput.checked);
    };

    const renderStageLayersPanel = () => {
      if (!state) return;
      stageLayersHead.textContent = `${tr("stageLayersPanel")} · ${state.layers.length}`;
      stageLayersAdd.disabled = state.layers.length >= 8;
      stageLayersList.replaceChildren();
      if (stageContext === "new-chat") {
        const promptRow = document.createElement("div");
        promptRow.className = "stage-chip stage-chip-prompt";
        promptRow.dataset.active = String(stageSelection?.kind === "prompt");
        const promptSelect = document.createElement("button");
        promptSelect.type = "button";
        promptSelect.className = "stage-chip-select";
        promptSelect.dataset.editorFocus = "stage-chip-prompt";
        promptSelect.textContent = tr("stagePromptTag");
        promptSelect.addEventListener("click", () => {
          selectStageItem({ kind: "prompt" }, { reveal: false });
        });
        promptRow.appendChild(promptSelect);
        stageLayersList.appendChild(promptRow);
      }
      for (const layer of state.layers) {
        const chip = document.createElement("div");
        chip.className = "stage-chip";
        chip.dataset.index = String(layer.index);
        chip.dataset.active = String(stageSelection?.kind === "layer" && stageSelection.index === layer.index);
        chip.dataset.stageHidden = String(stageHiddenLayers.has(layer.index));
        chip.dataset.gated = String(!stageLayerGate(layer));
        const select = document.createElement("button");
        select.type = "button";
        select.className = "stage-chip-select";
        select.dataset.editorFocus = `stage-chip-${layer.index}`;
        select.setAttribute("aria-label", format(tr("stageSelectLayer"), layer.index + 1));
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
        text.textContent = `${layer.index + 1} · ${tr(`role${layer.role[0].toUpperCase()}${layer.role.slice(1)}`)}`;
        select.append(thumb, text);
        select.addEventListener("click", () => {
          stageHiddenLayers.delete(layer.index);
          selectStageItem({ kind: "layer", index: layer.index }, { reveal: true });
          renderStage();
        });
        const up = document.createElement("button");
        up.type = "button";
        up.className = "stage-chip-order";
        up.textContent = "↑";
        up.disabled = layer.index === 0;
        up.dataset.editorFocus = `stage-order-up-${layer.index}`;
        up.setAttribute("aria-label", tr("moveUp"));
        up.addEventListener("click", () => {
          const base = mutationBase();
          if (base) post({ type: "move-theme-layer", ...base, index: layer.index, direction: "up" });
        });
        const down = document.createElement("button");
        down.type = "button";
        down.className = "stage-chip-order";
        down.textContent = "↓";
        down.disabled = layer.index === state.layers.length - 1;
        down.dataset.editorFocus = `stage-order-down-${layer.index}`;
        down.setAttribute("aria-label", tr("moveDown"));
        down.addEventListener("click", () => {
          const base = mutationBase();
          if (base) post({ type: "move-theme-layer", ...base, index: layer.index, direction: "down" });
        });
        const eye = document.createElement("button");
        eye.type = "button";
        eye.className = "stage-eye";
        eye.dataset.editorFocus = `stage-eye-${layer.index}`;
        eye.setAttribute("aria-pressed", String(!stageHiddenLayers.has(layer.index)));
        eye.setAttribute("aria-label", tr("stageEyeToggle"));
        eye.textContent = stageHiddenLayers.has(layer.index) ? "○" : "●";
        eye.addEventListener("click", () => {
          if (stageHiddenLayers.has(layer.index)) stageHiddenLayers.delete(layer.index);
          else {
            stageHiddenLayers.add(layer.index);
            if (stageSelection?.kind === "layer" && stageSelection.index === layer.index) stageSelection = null;
          }
          renderStage();
        });
        chip.append(select, up, down, eye);
        stageLayersList.appendChild(chip);
      }
    };

    const ensureStageStructure = () => {
      if (!state) return;
      const focused = document.activeElement?.dataset?.editorFocus ?? null;
      for (const index of [...stageHiddenLayers]) {
        if (index >= state.layers.length) stageHiddenLayers.delete(index);
      }
      const seen = new Set();
      let previous = null;
      for (const layer of state.layers) {
        if (stageHiddenLayers.has(layer.index) || !stageLayerGate(layer)) continue;
        seen.add(layer.index);
        let entry = stageLayerNodes.get(layer.index);
        if (entry && entry.previewUrl !== layer.previewUrl) {
          entry.wrap.remove();
          stageLayerNodes.delete(layer.index);
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
          item.dataset.stageItem = `layer-${layer.index}`;
          item.dataset.editorFocus = `stage-layer-${layer.index}`;
          item.tabIndex = 0;
          wrap.appendChild(item);
          entry = { wrap, item, previewUrl: layer.previewUrl };
          stageLayerNodes.set(layer.index, entry);
        }
        const roleLabel = tr(`role${layer.role[0].toUpperCase()}${layer.role.slice(1)}`);
        entry.item.setAttribute("aria-label", format(tr("stageLayerAria"), layer.index + 1, roleLabel));
        if (previous) previous.after(entry.wrap);
        else stageArt.prepend(entry.wrap);
        previous = entry.wrap;
      }
      for (const [index, entry] of [...stageLayerNodes]) {
        if (!seen.has(index)) {
          entry.wrap.remove();
          stageLayerNodes.delete(index);
        }
      }
      stageContentHost.replaceChildren(...(stageContext === "new-chat"
        ? [stagePromptEl]
        : [stageStripA, stageStripB, stageComposerEl]));
      stageEmptyNote.textContent = tr("stageEmpty");
      stageEmptyNote.hidden = seen.size > 0;
      if (stageSelection?.kind === "layer" && !seen.has(stageSelection.index)) stageSelection = null;
      if (stageSelection?.kind === "prompt" && stageContext !== "new-chat") stageSelection = null;
      renderStageLayersPanel();
      if (focused && !document.activeElement?.dataset?.editorFocus) {
        stageRoot.querySelector(`[data-editor-focus="${focused}"]`)?.focus();
      }
      syncStageToolbar();
    };

    const syncStageHud = () => {
      let target = null;
      if (stageSelection?.kind === "layer") target = stageLayerNodes.get(stageSelection.index)?.item ?? null;
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
      for (const node of stageEdges) node.setAttribute("aria-label", tr("stageMoveHandle"));
      const cornerPoints = {
        nw: [left - 7, top - 7], ne: [left + rect.width - 7, top - 7],
        sw: [left - 7, top + rect.height - 7], se: [left + rect.width - 7, top + rect.height - 7],
      };
      for (const node of stageCorners) {
        const point = cornerPoints[node.dataset.corner];
        node.hidden = false;
        node.style.left = `${clampX(point[0], 14)}px`;
        node.style.top = `${clampY(point[1], 14)}px`;
        node.setAttribute("aria-label", tr(prompt ? "stageWidthHandle" : "stageScaleHandle"));
      }
      if (prompt) {
        stageOpacityWrap.hidden = true;
      } else {
        const opacity = Number(stageValue(`layers[${stageSelection.index}].opacity`));
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
      const frameWidth = stageFrame.clientWidth;
      const scale = frameWidth > 0 ? frameWidth / logicalWidth : 0;
      stageFrame.style.height = scale ? `${Math.round(logicalHeight * scale)}px` : "";
      stageFrame.dataset.backdrop = captureActive ? "capture" : "schematic";
      const realContext = stageMirror?.geometry?.context;
      stageContextHint.hidden = !(backdropToggleInput?.checked && stageMirror
        && (realContext === "new-chat" || realContext === "conversation") && realContext !== stageContext);
      stageBackdropImg.hidden = !captureActive;
      if (captureActive && stageBackdropImg.src !== stageMirror.image) stageBackdropImg.src = stageMirror.image;
      stageSidebarEl.hidden = captureActive;
      stageCanvas.style.width = `${logicalWidth}px`;
      stageCanvas.style.height = `${logicalHeight}px`;
      stageCanvas.style.transform = `scale(${scale || 1})`;
      const tokenValue = (key) => stageValue(`tokens.${selectedMode}.${key}`);
      const scope = stageValue("shared.backgroundScope");
      const radius = Number(stageValue("shared.radius")) || 0;
      const blur = Number(stageValue("shared.blur")) || 0;
      const shadow = STAGE_SHADOWS[stageValue("shared.shadow")] ?? "none";
      stageCanvas.style.background = tokenValue("canvas") ?? "#808080";
      const mainMetrics = stageMainMetrics(logicalWidth, logicalHeight);
      stageArt.style.left = scope === "content" ? `${mainMetrics.left}px` : "0";
      const sidebarColor = tokenValue("sidebar") ?? "#808080";
      const sidebarAlpha = Number(tokenValue("sidebarAlpha")) || 1;
      stageSidebarEl.style.width = `${STAGE_SIDEBAR_WIDTH}px`;
      stageSidebarEl.style.background = scope === "full-window"
        ? `color-mix(in srgb, ${sidebarColor} ${Math.round(sidebarAlpha * 100)}%, transparent)`
        : sidebarColor;
      stageSidebarEl.style.backdropFilter = scope === "full-window" && blur ? `blur(${Math.min(blur, 32)}px)` : "";
      stageSidebarEl.style.borderRight = `1px solid ${tokenValue("border") ?? "transparent"}`;
      for (const [index, entry] of stageLayerNodes) {
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
          const deltaX = ((Number(stageValue("shared.prompt.x")) || 0) - (Number(statePath("shared.prompt.x")) || 0)) * mainMetrics.width;
          const deltaY = ((Number(stageValue("shared.prompt.y")) || 0) - (Number(statePath("shared.prompt.y")) || 0)) * mainMetrics.height;
          const deltaW = ((Number(stageValue("shared.prompt.width")) || 0) - (Number(statePath("shared.prompt.width")) || 0)) * mainMetrics.width;
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
      if (!mutationQueue.length && !pendingAction) stageOverrides.clear();
      ensureStageStructure();
      applyStageLayout();
      renderStageMatrix();
      updateLayerGateBadges();
    };

    const selectStageItem = (selection, { reveal = false } = {}) => {
      stageSelection = selection;
      for (const chip of stageLayersPanel.querySelectorAll(".stage-chip")) {
        chip.dataset.active = chip.classList.contains("stage-chip-prompt")
          ? String(selection?.kind === "prompt")
          : String(selection?.kind === "layer" && Number(chip.dataset.index) === selection.index);
      }
      if (selection?.kind === "layer") {
        if (reveal) {
          const card = layerList.querySelector(`[data-editor-layer="${selection.index}"]`);
          if (card) {
            card.open = true;
            card.scrollIntoView?.({ block: "nearest" });
          }
        }
        announce(format(tr("stageSelectedAnnounce"), format(tr("layerNumber"), selection.index + 1)));
      } else if (selection?.kind === "prompt") {
        announce(format(tr("stageSelectedAnnounce"), tr("stagePromptTag")));
      }
      syncStageHud();
    };

    const stageSelectionFromNode = (node) => node.dataset.stageItem === "prompt"
      ? { kind: "prompt" }
      : { kind: "layer", index: Number(node.dataset.stageItem.slice("layer-".length)) };

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
      if (!state || (event.button !== 0 && event.pointerType !== "touch")) return;
      if (event.target.closest?.(".stage-layers-panel, .stage-opacity")) return;
      const handle = event.target.closest?.("[data-stage-handle]");
      const itemNode = event.target.closest?.("[data-stage-item]");
      if (!handle && !itemNode) {
        selectStageItem(null);
        return;
      }
      event.preventDefault();
      let selection = stageSelection;
      if (itemNode) {
        selection = stageSelectionFromNode(itemNode);
        selectStageItem(selection, { reveal: true });
        itemNode.focus?.();
      }
      if (!selection) return;
      const [logicalWidth, logicalHeight] = stageLogicalSize();
      const scale = stageFrame.clientWidth > 0 ? stageFrame.clientWidth / logicalWidth : 1;
      if (selection.kind === "layer") stageLayerNodes.get(selection.index)?.wrap.classList.add("is-active");
      const start = {};
      for (const path of stageItemPaths(selection)) start[path] = Number(stageValue(path)) || 0;
      const targetRect = (selection.kind === "layer"
        ? stageLayerNodes.get(selection.index)?.item
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
          ? logicalWidth - stageMainMetrics(logicalWidth, logicalHeight).left
          : logicalWidth,
        mainWidth: stageMainMetrics(logicalWidth, logicalHeight).width,
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
        const prefix = `layers[${drag.selection.index}].frames.${stageViewport}.`;
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
        const prefix = `layers[${drag.selection.index}].frames.${stageViewport}.`;
        const factor = 1 + (((drag.signX * (event.clientX - drag.startX)) + (drag.signY * (event.clientY - drag.startY))) / drag.rectSize);
        setStageOverride(`${prefix}scale`, clampNumber(drag.start[`${prefix}scale`] * factor, 0.25, 3));
      } else if (drag.kind === "prompt-move") {
        let nextX = clampNumber(drag.start["shared.prompt.x"] + (dx / drag.mainWidth), -0.35, 0.35);
        let nextY = clampNumber(drag.start["shared.prompt.y"] + (dy / drag.logicalHeight), -0.3, 0.3);
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
      if (!state) return;
      const handle = event.target.closest?.("[data-stage-handle]");
      const itemNode = event.target.closest?.("[data-stage-item]");
      if (!handle && !itemNode) return;
      const selection = itemNode ? stageSelectionFromNode(itemNode) : stageSelection;
      if (!selection) return;
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        selectStageItem(selection, { reveal: true });
        return;
      }
      if (event.key === "Escape") {
        for (const path of stageItemPaths(selection)) stageOverrides.delete(path);
        if (stageKeyTimer) { clearTimeout(stageKeyTimer); stageKeyTimer = null; }
        applyStageLayout();
        return;
      }
      const step = event.shiftKey ? 5 : 1;
      let changed = false;
      const adjust = (path, delta, minimum, maximum) => {
        setStageOverride(path, clampNumber((Number(stageValue(path)) || 0) + delta, minimum, maximum));
        changed = true;
      };
      if (selection.kind === "layer") {
        const prefix = `layers[${selection.index}].frames.${stageViewport}.`;
        if (event.key === "ArrowLeft") adjust(`${prefix}positionX`, -step, -100, 100);
        else if (event.key === "ArrowRight") adjust(`${prefix}positionX`, step, -100, 100);
        else if (event.key === "ArrowUp") adjust(`${prefix}positionY`, -step, -100, 100);
        else if (event.key === "ArrowDown") adjust(`${prefix}positionY`, step, -100, 100);
        else if (event.key === "+" || event.key === "=") adjust(`${prefix}scale`, event.shiftKey ? 0.2 : 0.05, 0.25, 3);
        else if (event.key === "-" || event.key === "_") adjust(`${prefix}scale`, event.shiftKey ? -0.2 : -0.05, 0.25, 3);
      } else {
        const ratioStep = step / 100;
        if (event.key === "ArrowLeft") adjust("shared.prompt.x", -ratioStep, -0.35, 0.35);
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
      stageKeyTimer = setTimeout(() => {
        stageKeyTimer = null;
        commitStagePaths(paths);
      }, 600);
    });

    stageViewportInputs.forEach((input) => input.addEventListener("change", () => {
      if (!input.checked) return;
      stageViewport = input.value;
      if (backdropToggleInput?.checked && stageMirror) {
        // Editing a framing set drives the real window to that size, so the
        // next capture shows the layout being edited.
        send({ type: "set-aura-preview", size: input.value === "wide" ? "wide" : "launch" });
      }
      renderStage();
    }));
    stageContextInputs.forEach((input) => input.addEventListener("change", () => {
      if (input.checked) {
        stageContext = input.value;
        renderStage();
      }
    }));
    stageZonesInput?.addEventListener("change", () => {
      stageRoot.dataset.zones = String(stageZonesInput.checked);
    });
    backdropToggleInput?.addEventListener("change", () => {
      if (stageBackdropOn() && stageMirror) stageViewport = stageMirror.width >= 1440 ? "wide" : "normal";
      renderStage();
    });
    const levelInputs = [...document.querySelectorAll('input[name="editor-level"]')];
    levelInputs.forEach((input) => input.addEventListener("change", () => {
      if (!input.checked) return;
      editor.dataset.level = input.value;
      renderStage();
    }));
    for (const [id, size] of [
      ["stage-real-launch", "launch"], ["stage-real-wide", "wide"], ["stage-real-full", "full"],
    ]) {
      document.getElementById(id)?.addEventListener("click", () => {
        if (!send({ type: "set-aura-preview", size })) return;
        stageViewport = size === "launch" ? "normal" : "wide";
        renderStage();
        announce(tr("stageRealShown"));
      });
    }
    // Real-window mirror: scaled captures of the actual Aura WebView pushed
    // by the host. True proportions at any window size, never written to disk.
    const mirrorImage = document.getElementById("stage-mirror-image");
    const mirrorEmpty = document.getElementById("stage-mirror-empty");
    const mirrorCaption = document.getElementById("stage-mirror-caption");
    const MIRROR_PREFIX = "data:image/jpeg;base64,";
    const normalizeMirrorRect = (value) => {
      if (value === null || value === undefined) return null;
      if (!exactShape(value, ["left", "top", "width", "height"])) return undefined;
      for (const key of ["left", "top", "width", "height"]) {
        if (!inRange(value[key], -10000, 10000)) return undefined;
      }
      return { ...value };
    };
    const normalizeMirror = (value) => {
      if (!exactShape(value, ["type", "image", "width", "height"], ["geometry"]) || value.type !== "aura-mirror") return null;
      if (typeof value.image !== "string" || value.image.length > 8_000_000
          || !value.image.startsWith(MIRROR_PREFIX)
          || !/^[A-Za-z0-9+/]+={0,2}$/.test(value.image.slice(MIRROR_PREFIX.length))) return null;
      if (!integer(value.width, 200, 6000) || !integer(value.height, 200, 6000)) return null;
      let geometry = null;
      if (value.geometry !== undefined && value.geometry !== null) {
        if (!exactShape(value.geometry, ["context", "mode", "main", "prompt"])
            || !enumValue(value.geometry.context, ["new-chat", "conversation", "other"])
            || !enumValue(value.geometry.mode, ["light", "dark"])) return null;
        const main = normalizeMirrorRect(value.geometry.main);
        const prompt = normalizeMirrorRect(value.geometry.prompt);
        if (main === undefined || prompt === undefined) return null;
        geometry = { context: value.geometry.context, mode: value.geometry.mode, main, prompt };
      }
      return { image: value.image, width: value.width, height: value.height, geometry };
    };
    const receiveMirror = (raw) => {
      const mirror = normalizeMirror(raw);
      if (!mirror || !mirrorImage) return false;
      mirrorImage.src = mirror.image;
      mirrorImage.alt = tr("mirrorAlt");
      mirrorImage.hidden = false;
      if (mirrorEmpty) mirrorEmpty.hidden = true;
      if (mirrorCaption) mirrorCaption.textContent = format(tr("mirrorCaption"), mirror.width, mirror.height);
      const previousContext = stageMirror?.geometry?.context;
      const previousMode = stageMirror?.geometry?.mode;
      const first = !stageMirror;
      stageMirror = mirror;
      if (backdropToggleInput) backdropToggleInput.disabled = false;
      if (backdropToggleInput?.checked) {
        // The framing set being edited follows the real window's dimensions,
        // and the stage follows the real page when it navigates or reskins —
        // without fighting a user who deliberately picked the other view.
        stageViewport = mirror.width >= 1440 ? "wide" : "normal";
        const realContext = mirror.geometry?.context;
        if ((realContext === "new-chat" || realContext === "conversation")
            && (first || realContext !== previousContext)) {
          stageContext = realContext;
        }
        const realMode = mirror.geometry?.mode;
        if (realMode && realMode !== selectedMode && (first || realMode !== previousMode)) {
          selectedMode = realMode;
          for (const input of modeInputs) input.checked = input.value === selectedMode;
          reflectTokens();
        }
        if (first) announce(tr("stageBackdropReady"));
        renderStage();
        if (stageDrag && stageBackdropOn()) {
          stageBackdropImg.src = mirror.image;
          stageBackdropImg.hidden = false;
        }
      }
      return true;
    };
    document.getElementById("stage-mirror-refresh")?.addEventListener("click", () => {
      send({ type: "refresh-aura-mirror" });
    });
    let topmostEnabled = false;
    const topmostButton = document.getElementById("stage-real-topmost");
    topmostButton?.addEventListener("click", () => {
      if (!send({ type: "set-aura-topmost", enabled: !topmostEnabled })) return;
      topmostEnabled = !topmostEnabled;
      topmostButton.setAttribute("aria-pressed", String(topmostEnabled));
      announce(tr(topmostEnabled ? "topmostOn" : "topmostOff"));
    });
    document.getElementById("stage-real-apply")?.addEventListener("click", () => {
      const widthInput = document.getElementById("stage-real-width");
      const heightInput = document.getElementById("stage-real-height");
      const width = Math.round(clampNumber(Number(widthInput?.value) || 1180, 920, 3840));
      const height = Math.round(clampNumber(Number(heightInput?.value) || 640, 620, 2400));
      if (widthInput) widthInput.value = String(width);
      if (heightInput) heightInput.value = String(height);
      if (!send({ type: "set-aura-preview", size: `${width}x${height}` })) return;
      stageViewport = width >= 1440 ? "wide" : "normal";
      renderStage();
      announce(tr("stageRealShown"));
    });

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
            stageContext = context;
            for (const input of modeInputs) input.checked = input.value === selectedMode;
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
        const badge = layerList.querySelector(`[data-layer-badge="${layer.index}"]`);
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
    if (typeof ResizeObserver === "function") new ResizeObserver(() => applyStageLayout()).observe(stageRoot);
    // ── End live framing stage ─────────────────────────────────────────

    const buildTokenControls = () => {
      for (const group of TOKEN_GROUPS) {
        const details = document.createElement("details");
        details.className = "token-group";
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
            picker.addEventListener("change", () => postToken(selectedMode, token, picker.value.toUpperCase()));
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
              postToken(selectedMode, token, value);
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
            range.addEventListener("change", () => postToken(selectedMode, token, Number(range.value) / 100));
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
        const value = mode[token];
        input.dataset.editorField = `tokens.${selectedMode}.${token}`;
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
        chip.textContent = worst.ratio.toFixed(2);
        chip.dataset.pass = String(pass);
        chip.setAttribute("aria-label",
          `${tr(CONTRAST_LABEL_KEYS[worst.id])} ${worst.ratio.toFixed(2)} / ${worst.minimum.toFixed(2)} · ${tr(pass ? "checkPass" : "checkFail")}`);
        chip.hidden = false;
      }
    };

    const reflectShared = () => {
      if (!state) return;
      const values = state.shared;
      for (const input of sharedInputs) {
        const key = input.dataset.editorShared;
        input.value = String(values[key]);
      }
      document.getElementById("editor-radius-output").value = `${Math.round(values.radius)} px`;
      document.getElementById("editor-blur-output").value = `${Math.round(values.blur)} px`;
      for (const input of scopeInputs) input.checked = input.value === values.backgroundScope;
      document.getElementById("background-scope-help").textContent = tr(
        values.backgroundScope === "full-window" ? "fullScopeHelp" : "contentScopeHelp");
      document.querySelector(".asset-guide-frame").dataset.scope = values.backgroundScope;
      for (const input of promptInputs) {
        const key = input.dataset.editorPrompt;
        input.value = String(Math.round(values.prompt[key] * 100));
        const output = document.getElementById(`${input.id}-output`);
        if (output) output.value = `${Math.round(values.prompt[key] * 100)}%`;
      }
    };

    const option = (value, label) => {
      const node = document.createElement("option");
      node.value = value;
      node.textContent = label;
      return node;
    };

    const layerSelect = ({ layer, preset = "shared", property, labelKey, values }) => {
      const field = document.createElement("label");
      field.className = "layer-field";
      const label = document.createElement("span");
      label.textContent = tr(labelKey);
      const select = document.createElement("select");
      select.dataset.editorFocus = `layer-${layer.index}-${preset}-${property}`;
      select.dataset.editorField = preset === "shared"
        ? `layers[${layer.index}].${property}`
        : `layers[${layer.index}].frames.${preset}.${property}`;
      for (const [value, key] of values) select.appendChild(option(value, tr(key)));
      select.value = preset === "shared" ? String(layer[property]) : String(layer.frames[preset][property]);
      select.addEventListener("change", () => {
        setStageOverride(select.dataset.editorField, select.value);
        postLayer(layer.index, preset, property, select.value);
        renderStage();
      });
      field.append(label, select);
      return field;
    };

    const layerRange = ({ layer, preset = "shared", property, labelKey, min, max, step, value, display }) => {
      const field = document.createElement("label");
      field.className = "layer-field";
      const label = document.createElement("span");
      label.textContent = tr(labelKey);
      const output = document.createElement("output");
      const range = document.createElement("input");
      range.type = "range";
      range.min = String(min);
      range.max = String(max);
      range.step = String(step);
      range.value = String(value);
      range.dataset.editorFocus = `layer-${layer.index}-${preset}-${property}`;
      range.dataset.editorField = preset === "shared"
        ? `layers[${layer.index}].${property}`
        : `layers[${layer.index}].frames.${preset}.${property}`;
      const formatValue = () => display(range.valueAsNumber);
      output.value = formatValue();
      range.addEventListener("input", () => {
        output.value = formatValue();
        setStageOverride(range.dataset.editorField, range.valueAsNumber);
        applyStageLayout();
      });
      range.addEventListener("change", () => postLayer(layer.index, preset, property, range.valueAsNumber));
      label.append(" ", output);
      field.append(label, range);
      return field;
    };

    const renderFrame = (layer, preset) => {
      const frame = layer.frames[preset];
      const fieldset = document.createElement("fieldset");
      fieldset.className = "layer-preset";
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

    const renderLayers = (focusKey = null) => {
      layerList.replaceChildren();
      if (!state.layers.length) {
        const empty = document.createElement("p");
        empty.className = "editor-layer-empty";
        empty.textContent = tr("noLayers");
        layerList.appendChild(empty);
        return;
      }
      for (const layer of state.layers) {
        const card = document.createElement("details");
        card.className = "layer-card";
        card.dataset.editorLayer = String(layer.index);
        card.open = focusKey?.startsWith(`layer-${layer.index}-`) || layer.index === 0;
        const cardSummary = document.createElement("summary");
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
        strong.textContent = format(tr("layerNumber"), layer.index + 1);
        const small = document.createElement("small");
        const roleLabel = tr(`role${layer.role[0].toUpperCase()}${layer.role.slice(1)}`);
        const appearanceLabel = tr(`appearance${layer.appearance === "all" ? "All" : layer.appearance[0].toUpperCase() + layer.appearance.slice(1)}`);
        const contextKey = layer.context === "all" ? "contextAll" : layer.context === "new-chat" ? "contextNewChat" : "contextConversation";
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
        const actions = document.createElement("div");
        actions.className = "layer-actions";
        const replace = document.createElement("button");
        replace.type = "button";
        replace.className = "ghost-button";
        replace.textContent = tr("replaceImage");
        replace.dataset.editorFocus = `layer-${layer.index}-replace`;
        replace.addEventListener("click", () => {
          const base = mutationBase();
          if (base) post({ type: "pick-theme-layer-image", ...base, index: layer.index, role: layer.role });
        });
        const up = document.createElement("button");
        up.type = "button";
        up.className = "ghost-button";
        up.textContent = tr("moveUp");
        up.disabled = layer.index === 0;
        up.dataset.editorFocus = `layer-${layer.index}-move-up`;
        up.addEventListener("click", () => {
          const base = mutationBase();
          if (base) post({ type: "move-theme-layer", ...base, index: layer.index, direction: "up" });
        });
        const down = document.createElement("button");
        down.type = "button";
        down.className = "ghost-button";
        down.textContent = tr("moveDown");
        down.disabled = layer.index === state.layers.length - 1;
        down.dataset.editorFocus = `layer-${layer.index}-move-down`;
        down.addEventListener("click", () => {
          const base = mutationBase();
          if (base) post({ type: "move-theme-layer", ...base, index: layer.index, direction: "down" });
        });
        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "ghost-button";
        remove.textContent = tr("removeLayer");
        remove.dataset.editorFocus = `layer-${layer.index}-remove`;
        remove.addEventListener("click", () => {
          const base = mutationBase();
          if (base) post({ type: "remove-theme-layer", ...base, index: layer.index });
        });
        const copyWide = document.createElement("button");
        copyWide.type = "button";
        copyWide.className = "ghost-button";
        copyWide.textContent = tr("copyFramingToWide");
        copyWide.dataset.editorFocus = `layer-${layer.index}-copy-wide`;
        copyWide.addEventListener("click", () => copyLayerFraming(layer.index, "normal", "wide"));
        const copyNormal = document.createElement("button");
        copyNormal.type = "button";
        copyNormal.className = "ghost-button";
        copyNormal.textContent = tr("copyFramingToNormal");
        copyNormal.dataset.editorFocus = `layer-${layer.index}-copy-normal`;
        copyNormal.addEventListener("click", () => copyLayerFraming(layer.index, "wide", "normal"));
        actions.append(replace, up, down, copyWide, copyNormal, remove);

        const sharedGrid = document.createElement("div");
        sharedGrid.className = "layer-grid";
        sharedGrid.append(
          layerSelect({ layer, property: "role", labelKey: "layerRole", values: ROLE_IDS.map((value) => [value, `role${value[0].toUpperCase()}${value.slice(1)}`]) }),
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
        visibleInput.checked = layer.visible;
        visibleInput.dataset.editorFocus = `layer-${layer.index}-shared-visible`;
        visibleInput.dataset.editorField = `layers[${layer.index}].visible`;
        visibleInput.addEventListener("change", () => {
          setStageOverride(`layers[${layer.index}].visible`, visibleInput.checked);
          postLayer(layer.index, "shared", "visible", visibleInput.checked);
          renderStage();
        });
        visible.append(visibleInput, document.createTextNode(tr("layerVisible")));
        sharedGrid.appendChild(visible);

        const meta = document.createElement("p");
        meta.className = "layer-meta";
        meta.textContent = format(tr("imageBytes"), formatBytes(layer.bytes));
        body.append(actions, sharedGrid, renderFrame(layer, "normal"), renderFrame(layer, "wide"), meta);
        card.append(cardSummary, body);
        layerList.appendChild(card);
      }
      if (focusKey) requestAnimationFrame(() => layerList.querySelector(`[data-editor-focus="${focusKey}"]`)?.focus());
    };

    const focusError = (field) => {
      const direct = editor.querySelector(`[data-editor-field="${CSS.escape(field)}"]`);
      if (direct) {
        direct.closest("details")?.setAttribute("open", "");
        direct.focus();
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
        tokenGroups.querySelector(`[data-editor-token="${token}"]`)?.focus();
        return;
      }
      const layer = /^layers\[(\d)]$/.exec(field);
      if (layer) {
        const card = layerList.querySelector(`[data-editor-layer="${layer[1]}"]`);
        if (card) {
          card.open = true;
          card.querySelector("summary")?.focus();
          return;
        }
      }
      (field.startsWith("budget.") ? feedbackRoot : title).focus();
    };

    const renderFeedback = () => {
      feedbackRoot.replaceChildren();
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
      if (state.feedback.errors.length) {
        const first = state.feedback.errors[0];
        const message = document.createElement("span");
        message.textContent = format(tr("validationIssue"), first.field);
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
      const busy = Boolean(pendingAction);
      undoButton.disabled = busy || !state.canUndo;
      redoButton.disabled = busy || !state.canRedo;
      resetButton.disabled = busy || !state.dirty;
      saveButton.disabled = busy || (!state.dirty && !state.isNew) || !state.feedback.valid;
      cancelButton.disabled = busy;
      addLayerButton.disabled = busy || state.layers.length >= 8;
    };

    const reflect = (focusKey = null) => {
      if (!state) return;
      title.textContent = format(tr("editorTitleFor"), state.label);
      summary.textContent = tr("editorSummary");
      dirtyPill.textContent = state.dirty ? tr("unsavedState") : tr("savedState");
      dirtyPill.dataset.state = state.dirty ? "dirty" : "saved";
      validPill.textContent = state.feedback.valid ? tr("validState") : tr("invalidState");
      validPill.dataset.state = state.feedback.valid ? "valid" : "invalid";
      for (const input of modeInputs) input.checked = input.value === selectedMode;
      reflectTokens();
      reflectShared();
      renderLayers(focusKey);
      renderFeedback();
      reflectButtonStates();
      renderStage();
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
      }
      returnTheme = normalized.isNew ? normalized.sourceId : normalized.id;
      state = normalized;
      if (normalized.lastAction && normalized.lastAction === pendingAction) {
        const succeeded = normalized.actionSucceeded !== false;
        setPending(null);
        if (!succeeded) dropStageWork();
        announce(succeeded ? tr("editorReady") : tr("editorActionFailed"), succeeded ? "ok" : "error");
      } else if (!pendingAction) setPending(null);
      showEditor();
      reflect(entering ? null : focusKey);
      if (entering) announce(tr("editorReady"));
      pumpMutationQueue();
      return true;
    };

    modeInputs.forEach((input) => input.addEventListener("change", () => {
      if (!input.checked) return;
      if (selectedMode !== input.value) {
        appearanceTouched = true;
        send({ type: "set-appearance", appearance: input.value });
      }
      selectedMode = input.value;
      reflectTokens();
      renderStage();
    }));
    document.getElementById("copy-light-dark").addEventListener("click", () => postToken("mode-copy", "tokens", "light"));
    document.getElementById("copy-dark-light").addEventListener("click", () => postToken("mode-copy", "tokens", "dark"));

    sharedInputs.forEach((input) => {
      const key = input.dataset.editorShared;
      input.addEventListener("input", () => {
        if (key === "radius") document.getElementById("editor-radius-output").value = `${input.value} px`;
        if (key === "blur") document.getElementById("editor-blur-output").value = `${input.value} px`;
        if (input.type === "range") {
          setStageOverride(input.dataset.editorField, input.valueAsNumber);
          applyStageLayout();
        }
      });
      input.addEventListener("change", () => {
        const value = input.type === "range" ? input.valueAsNumber : input.value;
        setStageOverride(input.dataset.editorField, value);
        applyStageLayout();
        postToken("shared", key, value);
      });
    });
    scopeInputs.forEach((input) => input.addEventListener("change", () => {
      if (!input.checked) return;
      setStageOverride("shared.backgroundScope", input.value);
      applyStageLayout();
      postToken("shared", "backgroundScope", input.value);
    }));
    promptInputs.forEach((input) => {
      input.addEventListener("input", () => {
        document.getElementById(`${input.id}-output`).value = `${input.value}%`;
        setStageOverride(input.dataset.editorField, input.valueAsNumber / 100);
        applyStageLayout();
      });
      input.addEventListener("change", () => {
        const token = input.dataset.editorPrompt === "width" ? "promptWidth"
          : input.dataset.editorPrompt === "x" ? "promptX" : "promptY";
        postToken("shared", token, input.valueAsNumber / 100);
      });
    });

    undoButton.addEventListener("click", () => {
      const base = mutationBase();
      if (base) post({ type: "undo-theme-edit", ...base });
    });
    redoButton.addEventListener("click", () => {
      const base = mutationBase();
      if (base) post({ type: "redo-theme-edit", ...base });
    });
    resetButton.addEventListener("click", () => showConfirm({
      titleText: tr("confirmResetTitle"), bodyText: tr("confirmResetBody"), actionText: tr("confirmResetAction"),
      opener: resetButton, callback: () => state && post({ type: "begin-theme-edit", theme: state.id, reset: true }),
    }));
    saveButton.addEventListener("click", () => {
      if (!state?.feedback.valid) {
        errorSummary.hidden = false;
        errorSummary.focus?.();
        announce(tr("saveBlocked"), "error");
        return;
      }
      const base = mutationBase();
      if (base) post({ type: "save-theme-edit", ...base });
    });
    const discard = () => {
      const base = mutationBase();
      if (base) post({ type: "discard-theme-edit", ...base });
    };
    cancelButton.addEventListener("click", () => {
      if (!state?.dirty) { discard(); return; }
      showConfirm({
        titleText: tr("confirmDiscardTitle"), bodyText: tr("confirmDiscardBody"), actionText: tr("confirmDiscardAction"),
        opener: cancelButton, callback: discard,
      });
    });
    addLayerButton.addEventListener("click", () => {
      if (!state || state.layers.length >= 8) { announce(tr("layerLimit"), "error"); return; }
      const base = mutationBase();
      if (base) post({ type: "pick-theme-layer-image", ...base, index: -1, role: "decoration" });
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
          : slot.startsWith("card-") ? tr("promptRuleCard") : tr("promptRuleBrand");
    const buildPrompt = () => {
      const slotOption = SLOT_OPTIONS.find(([value]) => value === promptSlot.value) ?? SLOT_OPTIONS[0];
      const subject = cleanPromptText(promptSubject.value) || tr("promptFallbackSubject");
      const style = cleanPromptText(promptStyle.value) || tr("promptFallbackStyle");
      promptOutput.value = format(tr("promptTemplate"), tr(slotOption[1]), subject, style, promptRule(slotOption[0]));
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
    });
  }

  window.CLAUDE_AURA_EDITOR = Object.freeze({ createController, normalizeEditorState });
})();
