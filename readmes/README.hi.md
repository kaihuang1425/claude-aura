<a id="readme-top"></a>

# Claude Aura

<p align="center">
  <a href="../README.md">English</a> ·
  <a href="./README.zh-CN.md">简体中文</a> ·
  <a href="./README.zh-HKTW.md">繁體中文</a> ·
  <strong>हिन्दी</strong> ·
  <a href="./README.es.md">Español</a> ·
  <a href="./README.fr.md">Français</a> ·
  <a href="./README.id.md">Bahasa Indonesia</a> ·
  <a href="./README.ja.md">日本語</a> ·
  <a href="./README.ko.md">한국어</a> ·
  <a href="./README.pt-BR.md">Português (Brasil)</a> ·
  <a href="./README.de.md">Deutsch</a> ·
  <a href="./README.it.md">Italiano</a> ·
  <a href="./README.vi.md">Tiếng Việt</a> ·
  <a href="./README.pl.md">Polski</a> ·
  <a href="./README.tr.md">Türkçe</a>
</p>

<p align="center">
  <strong>Windows पर लाइव Claude वेबसाइट पर एक निजी, पुनर्स्थापित करने योग्य थीम दें।</strong><br>
  स्थानीय थीम्स · कोई Claude Desktop पैचिंग नहीं · एक क्लिक में मूल रूप पर वापसी
</p>

<p align="center">
  <a href="#getting-started">शुरुआत करें</a> ·
  <a href="#theme-showcase">थीम देखें</a> ·
  <a href="#create-a-custom-theme">थीम बनाएं</a> ·
  <a href="../docs/TROUBLESHOOTING.md">समस्या निवारण</a> ·
  <a href="./SECURITY.md">सुरक्षा</a>
</p>

<p align="center">
  <img src="../docs/readme-showcase/japanese-film-editorial-dark-new-chat.png"
       alt="Japanese Film Editorial dark new-chat reference preview"
       width="900"><br>
  <sub>डार्क · नई चैट · उपयोगकर्ता-प्रदान दस्तावेज़ीकरण शोकेस</sub>
</p>

<p align="center"><sub>संदर्भ पूर्वावलोकन · आयात-योग्य थीम बैकग्राउंड या लाइव स्वीकृति प्रमाण नहीं</sub></p>

> **Independent project.** Claude Aura अनौपचारिक है और Anthropic PBC से संबंधित, प्रायोजित, अनुमोदित या सहमति से समर्थित नहीं है। Aura `claude.ai` पर लाइव वेबसाइट दिखाता है; यह Claude या Anthropic के स्थापित applications को बदलता नहीं है। Claude, Anthropic और संबंधित नाम व चिह्न Anthropic PBC के हैं। परियोजना का लाइसेंस इन सामग्रियों पर कोई अधिकार प्रदान नहीं करता।

<details>
<summary><strong>Public or commercial release trademark note</strong></summary>

> **Before public or commercial release:** Anthropic's current
> [Trademark Guidelines](https://www.anthropic.com/legal/trademark-guidelines)
> require prior approval for its names and marks and prohibit altered marks. A
> disclaimer is not permission. A release that keeps the **Claude Aura** name
> or theme-styled Claude wordmarks needs written permission and appropriate
> legal review.

</details>

<a id="contents"></a>
<details>
<summary><strong>सामग्री</strong></summary>

- [Claude Aura](#claude-aura)
  - [क्यों ऑरा](#why-aura)
  - [त्वरित शुरुआत](#quick-start)
    - [आवश्यकताएँ](#requirements)
    - [इंस्टॉलेशन](#installation)
    - [अनइंस्टॉल](#uninstall)
  - [थीम शोकेस](#theme-showcase)
    - [Japanese Film Editorial](#japanese-film-editorial)
    - [Japanese Idol](#japanese-idol)
    - [Korean Idol](#korean-idol)
  - [ऑरा का उपयोग करें](#use-aura)
  - [कस्टम थीम बनाएं](#create-a-custom-theme)
  - [ऑरा कैसे काम करता है](#how-aura-works)
  - [सुरक्षा और गोपनीयता](#safety-and-privacy)
  - [रोडमैप](#roadmap)
  - [समर्थन और दस्तावेज़ीकरण](#support-and-documentation)
    - [दस्तावेज़ मानचित्र](#documentation-map)
  - [परोपकारी सहायता](#charitable-support)
  - [लाइसेंस और नोटिस](#license-and-notices)
  - [आभार](#acknowledgments)

</details>
<a id="about-claude-aura"></a>
<a id="why-aura"></a>
## क्यों ऑरा

- **लाइव Claude वेबसाइट का उपयोग करें।** ऑरा वास्तविक इंटरफ़ेस और उसके देशी नियंत्रणों को बरकरार रखता है, बजाय इसकी जगह स्क्रीन-आधारित किसी पुनर्निर्मित स्क्रीन को रखने के।
- **परिवर्तन स्थानीय और उलटने योग्य रखें।** यह Claude Desktop को पैच किए बिना स्थानीय स्टाइलिंग लागू करता है, और **Original look** एक क्लिक में ऑरा की प्रस्तुति परत हटाकर मूल रूप दिखाता है।
- **आठ बिल्ट-इन थीम से शुरुआत करें।** प्रत्येक एक स्थिर, केवल-पठन हेतु प्रारंभिक विकल्प के रूप में उपलब्ध है।
- **मूल थीम हटाए बिना थीम बनाएं।** Claude Aura Studio स्थानीय रंग, टाइपोग्राफी, शैलियाँ, प्रभाव और कला-सामग्री को संभालता है।

Aura 0.3 अभी केवल लाइव वेबसाइट को थीम करता है। यह अभी native Claude Desktop Code या Claude Code टर्मिनल को थीम नहीं करता, और ऑरा के भीतर साधारण chat में local-project access उपलब्ध नहीं होता। अंतिम रिलीज़ से पहले, Aura Code को live `claude.ai/code` पर थीम-युक्त आधिकारिक
[Remote Control](https://code.claude.com/docs/en/remote-control) सत्र में रिलीज़ ब्लॉकर proof पास करना होगा; matching terminal-theme export सीमित वातावरण के लिए बिना Claude Desktop को पैच किए देता है।

<details>
<summary><strong>सभी क्षमताएँ और सीमाएँ</strong></summary>

Claude Aura वास्तविक `claude.ai` वेबसाइट को एक समर्पित Microsoft Edge WebView2
विंडो में खोलता है और स्थानीय दृश्य थीम लागू करता है। यह उन लोगों के लिए बना है जो Claude Desktop को पैच किए बिना अधिक निजी वर्कस्पेस चाहते हैं, बिना लाइव इंटरफ़ेस को स्क्रीनशॉट या reconstrued UI से बदलने के.

| Aura does | Aura does not |
| --- | --- |
| WebView2 में लाइव `claude.ai` इंटरफ़ेस लोड करता है | पुनर्निर्मित इंटरफ़ेस से Claude को बदलता है |
| उलटने योग्य स्थानीय स्टाइलिंग लागू करता है | Claude Desktop, `app.asar`, Windows packages या code signatures को पैच करता है |
| आठ बिल्ट-इन थीम देता है | Claude खाता, चैट, API keys, मॉडल, या provider सेटिंग बदलता है |
| Studio द्वारा स्थानीय कस्टम थीम प्रदान करता है | अपने को Anthropic उत्पाद या आधिकारिक थीम सिस्टम बताता है |
| **Original look** ऐप के अंदर उपलब्ध कराता है | टर्न ऑफ होने पर सेव की गई थीम हटाता है |

</details>

<p align="right">(<a href="#readme-top">शीर्ष पर वापस</a>)</p>
<a id="getting-started"></a>
## त्वरित शुरुआत

<a id="requirements"></a>
### आवश्यकताएँ

- Windows 10 या Windows 11
- इंटरनेट एक्सेस और Claude खाता
- [Node.js 22 या नया](https://nodejs.org/en/download)
- [Microsoft Edge WebView2 Runtime](https://developer.microsoft.com/en-us/microsoft-edge/webview2/)

WebView2 अधिकांश वर्तमान Windows कंप्यूटरों में मौजूद होता है। यदि ऑरा ब्राउज़र विंडो नहीं खोल पाता है, तो Evergreen WebView2 Runtime को install या repair करें और पुनः प्रयास करें। Claude Desktop वैकल्पिक है और अलग application रहता है।

<a id="installation"></a>
### इंस्टॉलेशन

1. डाउनलोड करें
   [latest release ZIP](https://github.com/erichuang1425/claude-aura/releases).
2. File Explorer में ZIP पर right-click करें और **Extract All** चुनें।
3. निकाले गए फ़ोल्डर को खोलें और **Install Claude Aura.cmd** पर दो बार क्लिक करें।
4. इंस्टॉलर बंद होने और **Claude Aura** विंडो खुलने तक प्रतीक्षा करें।
5. यदि `claude.ai` पूछे तो ऑरा के अंदर sign in करें।
6. फ्लोटिंग Aura बटन क्लिक करके Studio खोलें, फिर **Themes** चुनें।

इंस्टॉलेशन Claude Desktop को patch या replace नहीं करता।

<details>
<summary><strong>Installer behavior, application location, developer checkouts, and uninstall</strong></summary>

नो-एडमिन installer पहले अपनी built-in validation checks चलाता है, फिर application files को यहाँ कॉपी करता है:

```text
%LOCALAPPDATA%\ClaudeAura\app
```

यह desktop और Start मेन्यू में **Claude Aura** तथा **Claude Aura Studio** शॉर्टकट बनाता है। थीम सेटिंग्स और sign-in डेटा application से अलग रखा जाता है, इसलिए Aura पुनः इंस्टॉल करने पर वे चुपचाप बदलते नहीं हैं।

डेवलपर्स ZIP डाउनलोड करने के बजाय repository क्लोन करके भी यही installer चला सकते हैं। Checkout से पहले पूरी repository test suite रन होती है, फिर installation होती है।

<a id="uninstall"></a>
### अनइंस्टॉल

पहले फ्लोटिंग Aura बटन पर right-click करें और **Exit Claude Aura** चुनें। फिर
**Start > Claude Aura > Uninstall Claude Aura** खोलें, या रिलीज़ में निकाले फोल्डर में मौजूद **Uninstall Claude Aura.cmd** पर दो बार क्लिक करें। अनइंस्टॉलर तब तक आगे नहीं बढ़ता जब तक ऑरा अभी भी खुला हो।

डिफ़ॉल्ट रूप से अनइंस्टॉल Aura ऐप और शॉर्टकट हटाता है, लेकिन स्थानीय थीम सेटिंग्स और ऑरा की अलग WebView साइन-इन प्रोफ़ाइल को बाद के reinstall के लिए छोड़ देता है। अनइंस्टॉलर उन फ़ोल्डरों को हटाने से पहले पूछता भी है। वह विकल्प चुनने पर केवल ऑरा की local sign-in session हटती है; यह कभी भी Claude Desktop, उपयोगकर्ता का Anthropic खाता, या server-side खाता डेटा नहीं हटाता।

</details>
<p align="right">(<a href="#readme-top">शीर्ष पर वापस</a>)</p>

<a id="theme-showcase"></a>
## थीम शोकेस

ऑरा का दृश्य सिस्टम नीचे New chat और Conversation संदर्भों के माध्यम से दिखाया गया है। शीर्ष पर दिखाया गया Japanese Film Editorial New chat पूर्वावलोकन README के शीर्ष पर है।

**Default · Japanese Film Editorial · Korean Prestige · Cartoon Studio · Anime Twilight · Study Library · Japanese Idol · Korean Idol**

<a id="japanese-film-editorial"></a>
### Japanese Film Editorial

गरम कागज़, चारकोल इंक, धीमा इंडिगो, और संयत vermilion.

<details>
<summary>Conversation view देखें</summary>

<p align="center">
  <img src="../docs/readme-showcase/japanese-film-editorial-dark-conversation.png"
       alt="Japanese Film Editorial dark conversation reference preview"
       width="900"><br>
  <sub>डार्क · Conversation · उपयोगकर्ता-प्रदान दस्तावेज़ीकरण शोकेस</sub>
</p>

</details>

<a id="japanese-idol"></a>
### Japanese Idol

गरम क्रीम, blush, rose, मोती जैसा lilac और बारीक ribbon विवरण.

<p align="center">
  <img src="../docs/readme-showcase/japanese-idol-light-new-chat.png"
       alt="Japanese Idol light new-chat reference preview"
       width="900"><br>
  <sub>लाइट · नई चैट · उपयोगकर्ता-प्रदान दस्तावेज़ीकरण शोकेस</sub>
</p>

<details>
<summary>Conversation view देखें</summary>

<p align="center">
  <img src="../docs/readme-showcase/japanese-idol-light-conversation.png"
       alt="Japanese Idol light conversation reference preview"
       width="900"><br>
  <sub>लाइट · Conversation · उपयोगकर्ता-प्रदान दस्तावेज़ीकरण शोकेस</sub>
</p>

</details>

<a id="korean-idol"></a>
### Korean Idol

ठंडा सफेद, periwinkle, होलोग्राफिक सिल्वर, और संरचित संगीत ग्लास.

<p align="center">
  <img src="../docs/readme-showcase/korean-idol-light-new-chat.png"
       alt="Korean Idol light new-chat reference preview"
       width="900"><br>
  <sub>लाइट · नई चैट · उपयोगकर्ता-प्रदान दस्तावेज़ीकरण शोकेस</sub>
</p>

<details>
<summary>Conversation view देखें</summary>

<p align="center">
  <img src="../docs/readme-showcase/korean-idol-light-conversation.png"
       alt="Korean Idol light conversation reference preview"
       width="900"><br>
  <sub>लाइट · Conversation · उपयोगकर्ता-प्रदान दस्तावेज़ीकरण शोकेस</sub>
</p>

</details>

<details>
<summary><strong>संदर्भ स्थिति और पुनः उपयोग सीमाएँ</strong></summary>

> **Reference status:** ये user-supplied images प्रस्तावित दृश्य दिशा दिखाती हैं। इनमें illustrative interface content हो सकता है और ये live acceptance evidence या वर्तमान `claude.ai` behavior का proof नहीं हैं। ये theme backgrounds नहीं हैं, इन्हें Aura में import नहीं करना चाहिए, और release installers से बाहर रखे जाते हैं।
>
> पूर्वावलोकनों में third-party product UI, नाम या marks, और human-like portrait artwork हो सकता है। इनका समावेश पुनः उपयोग अधिकार नहीं देता। आगे प्रकाशन या redistribution से पहले लागू interface, trademark, artwork और likeness rights की पुष्टि करें।

</details>

<a id="built-in-themes"></a>
<details>
<summary><strong>सभी बिल्ट-इन थीम और स्थिर IDs</strong></summary>

Aura क्रम से आठ बिल्ट-इन थीम प्रदान करता है:

| # | Theme | Stable ID |
| ---: | --- | --- |
| 1 | Default | `default` |
| 2 | Japanese Film Editorial | `japanese-film-editorial` |
| 3 | Korean Prestige | `korean-prestige` |
| 4 | Cartoon Studio | `cartoon-studio` |
| 5 | Anime Twilight | `anime-twilight` |
| 6 | Study Library | `study-library` |
| 7 | Japanese Idol | `japanese-idol` |
| 8 | Korean Idol | `korean-idol` |

Built-ins read-only हैं। Studio किसी को customize करना हो तो editable copy बनाता है।

</details>

<p align="right">(<a href="#readme-top">शीर्ष पर वापस</a>)</p>
<a id="use-aura"></a>
## ऑरा का उपयोग करें

| Action | What it does |
| --- | --- |
| फ्लोटिंग Aura बटन क्लिक करें | Claude Aura Studio खोलता है |
| **Themes** | बिल्ट-इन गैलरी खोलता है और चयनित थीम सहेजता है |
| **Create a theme** | Aura-owned कस्टम थीम बनाता या संपादित करता है |
| **Personal wallpaper > Choose wallpaper*** | चयनित थीम से अलग स्थानीय image चुनता है |
| **Clear wallpaper** | wallpaper हटाता है बिना स्रोत फ़ाइल हटाए |
| **Original look** | ऑरा स्टाइलिंग हटाकर चुने बिना live साइट दिखाता है |
| **Apply theme** | Original look के बाद सेव की गई Aura थीम वापस लागू करता है |
| **Open desktop app** | बिना बदलें, Claude Desktop खोलता है |

चयनित थीम Aura restarts के बाद भी बनी रहती है। **Original look** केवल प्रस्तुति परत बंद करता है; यह saved themes या custom artwork हटाता नहीं। **Default** ऑरा की पहली built-in थीम है; यह Original look नहीं है.

फ्लोटिंग Aura launcher छोटा गोल नियंत्रण बना रहता है। क्लिक करके Studio खोलें, drag करके स्थान बदलें, या right-click करके Aura मेनू देखें.

Personal wallpaper मूल image path से जुड़ा है। यदि फ़ाइल हटती/हटाई जाती है, तो wallpaper उपलब्ध नहीं रहेगा। Studio के माध्यम से imported artwork अलग path पर जाता है: Studio इसे Aura-owned theme folders में copy या convert करता है।

<p align="right">(<a href="#readme-top">शीर्ष पर वापस</a>)</p>

<a id="create-a-custom-theme"></a>
## कस्टम थीम बनाएं

1. Desktop या Start menu से **Claude Aura Studio** खोलें।
2. **Create a theme** खोलकर **Customize Default** चुनें, या **Themes** खोलें, कोई built-in चुनें और **Duplicate to customize** चुनें।
3. Light और Dark रंग, टाइपोग्राफी, shapes, effects, और स्थानीय artwork समायोजित करें।
4. Studio preview में New chat और Conversation लेआउट देखें।
5. कोई contrast या file-size warnings हल करें।
6. **Save theme** चुनें।

बिल्ट-इन files कभी overwrite नहीं होते। यदि कोई ड्राफ्ट अमान्य हो जाता है, तो भी Aura अंतिम वैध संस्करण दिखाता रहता है और ड्राफ्ट editable रहता है।

Imported PNG, JPEG, WebP, या AVIF artwork को लोकल स्तर पर बजटेड WebP assets में बदल दिया जाता है। Studio source file path को थीम के अंदर नहीं रखता। पूर्ण editor और theme contract के लिए देखें
[Theme Kit Specification](../docs/THEME_KIT_SPEC.md).

जब उपलब्ध हो, Studio वास्तविक Aura विंडो की capture को editing backdrop के रूप में ले सकता है। वह capture वार्तालाप सामग्री रख सकता है, केवल वर्तमान editing session के लिए मेमोरी में रहता है, और कभी disk पर नहीं लिखा जाता।

<p align="right">(<a href="#readme-top">शीर्ष पर वापस</a>)</p>

<a id="built-with"></a>
<a id="how-aura-works"></a>
## ऑरा कैसे काम करता है

| Part | Purpose |
| --- | --- |
| Windows PowerShell और WinForms | Installer, Aura विंडो, Studio, shorcuts, और स्थानीय controls |
| Microsoft Edge WebView2 | वास्तविक `claude.ai` वेबसाइट दिखाता है |
| Node.js 22+ | थीम्स को validate करता है और local theme styling बनाता है |
| Local HTML, CSS, JavaScript, SVG, और WebP | Aura styling और बिल्ट-इन थीम assets देता है |

इस परियोजना में कोई npm package या runtime font dependency नहीं है।

<p align="right">(<a href="#readme-top">शीर्ष पर वापस</a>)

<a id="safety-and-privacy"></a>
## सुरक्षा और गोपनीयता

- Aura Microsoft Edge WebView2 में वास्तविक HTTPS वेबसाइट `claude.ai` लोड करता है।
- साइन-इन provider pages थीम नहीं होती हैं।
- Aura किसी remote-debugging port को नहीं खोलता और Claude Desktop नहीं पैच करता।
- थीम files और imported artwork Aura-owned local folders में रहते हैं।
- लाइव webpage अभी भी Anthropic से सामान्यतः जुड़ा रहता है।
- WebView profile में साइन-इन session data होता है और इसे सुरक्षित रखना चाहिए।
- Studio live-page captures वर्तमान editing session के लिए memory में रहते हैं और disk पर नहीं सहेजे जाते हैं।
- कोई संवेदनशील background image मत चुनें; live page तकनीकी रूप से अपने process के अंदर DOM data एक्सेस कर सकता है।
- लाइव सेवा का उपयोग अभी भी Anthropic के वर्तमान [Consumer Terms](https://www.anthropic.com/terms) और [Usage Policy](https://www.anthropic.com/legal/aup) के अधीन है।

Trust boundary के लिए [SECURITY.md](./SECURITY.md) पढ़ें और sign-in, loading, theme, image, और WebView2 मदद के लिए [Troubleshooting](../docs/TROUBLESHOOTING.md) देखें।

<a id="local-data"></a>
<details>
<summary><strong>लोकल डेटा फोल्डर और अनइंस्टॉल रिटेंशन</strong></summary>

Aura अपने application, settings, themes, drafts, और browser profile अलग रखता है:

| Path | Contents |
| --- | --- |
| `%LOCALAPPDATA%\ClaudeAura\app` | स्थापित Aura application |
| `%LOCALAPPDATA%\ClaudeAura\data` | Settings, logs, और Aura-owned local state |
| `%LOCALAPPDATA%\ClaudeAura\data\themes` | सेव की गई custom themes और derived artwork |
| `%LOCALAPPDATA%\ClaudeAura\data\theme-drafts` | प्रगति में Studio drafts |
| `%LOCALAPPDATA%\ClaudeAura\webview` | Aura का अलग WebView2 साइन-इन profile |

`webview` फोल्डर को signed-in browser profile की तरह संभालें। इसे publish या share न करें। Default uninstall `data` और `webview` छोड़ता है; हटाने का विकल्प सिर्फ तब चुनें जब आप वही local settings, themes और अलग साइन-इन profile मिटाना भी चाहते हों।

</details>

<p align="right">(<a href="#readme-top">शीर्ष पर वापस</a>)</p>

<a id="roadmap"></a>
## रोडमैप

- [x] समर्पित Windows WebView2 companion और उलटने योग्य **Original look**
- [x] Light और Dark समर्थन के साथ आठ स्थिर बिल्ट-इन थीमें
- [ ] नो-कोड Studio visual editor पूरा करके समीक्षा करना
- [ ] आधिकारिक local Claude Code Remote Control के लिए Aura Code को पूरा करना, matching terminal-theme export के साथ
- [ ] 30 मिनट कस्टम थीम ट्यूटोरियल प्रकाशित करना
- [ ] अंतिम रिलीज़ verification sweep चलाना

देखें
[implementation report](../docs/IMPLEMENTATION_REPORT.md) और
[repository issues](https://github.com/erichuang1425/claude-aura/issues) सार्वजनिक स्थिति के लिए। संदर्भ पूर्वावलोकन आवश्यक live Aura acceptance evidence का विकल्प नहीं है।

<p align="right">(<a href="#readme-top">शीर्ष पर वापस</a>)</p>
<a id="support"></a>
## समर्थन और दस्तावेज़ीकरण

[Troubleshooting](../docs/TROUBLESHOOTING.md) से शुरू करें। किसी reproducible bug या feature request के लिए
[repository issues](https://github.com/erichuang1425/claude-aura/issues) का उपयोग करें.

जब bug रिपोर्ट करें, Windows, Node.js, और WebView2 versions, active theme ID, और समस्या दोहराने के steps शामिल करें। Logs साझा करने से पहले review करें; Aura UI log यहाँ रहता है:

```text
%LOCALAPPDATA%\ClaudeAura\data\aura-ui.log
```

सुरक्षा मुद्दों की रिपोर्ट [SECURITY.md](./SECURITY.md) में बताई private repository security advisory से करें.

<a id="documentation-map"></a>
### दस्तावेज़ मानचित्र

- [Troubleshooting](../docs/TROUBLESHOOTING.md)
- [Security and trust boundary](./SECURITY.md)
- [Theming guide](../docs/THEMING.md)
- [Theme Kit Specification](../docs/THEME_KIT_SPEC.md)
- [Implementation report](../docs/IMPLEMENTATION_REPORT.md)
- [File Manifest](../docs/FILE_MANIFEST.md)
- [Contributing guide](./CONTRIBUTING.md)
- [Repository issues](https://github.com/erichuang1425/claude-aura/issues)

<a id="contributing"></a>
<details>
<summary><strong>Contributing checks and project boundaries</strong></summary>

Submit करने से पहले आवश्यक checks चलाएं:

```powershell
npm run check
npm run verify:cycle
```

एक single built-in theme audit के लिए:

```powershell
node scripts/theme-cli.mjs qa <id>
```

निम्न project boundaries को बरकरार रखें:

- कोई npm या runtime font dependency न जोड़ें।
- आठ स्थिर थीम IDs और उनका क्रम न बदलें।
- reconstructed Claude interface HTML को product content के रूप में न भेजें।
- reference images को UI acceptance evidence के रूप में न जमा करें।
- योगदान किए गए मीडिया के लिए स्रोत, license, और distribution जानकारी जोड़ें।n
देखें [CONTRIBUTING.md](./CONTRIBUTING.md), [Theming guide](../docs/THEMING.md), [Theme Kit Specification](../docs/THEME_KIT_SPEC.md), और [File Manifest](../docs/FILE_MANIFEST.md) theme system या release tree बदलने से पहले.

</details>

<p align="right">(<a href="#readme-top">शीर्ष पर वापस</a>)</p>

<a id="charitable-support"></a>
## परोपकारी सहायता

Claude Aura किसी व्यक्तिगत donation, tip, sponsorship, referral payment या किसी अन्य वित्तीय सहायता को स्वीकार नहीं करता। मालिक अभी वर्तमान में United Kingdom में [Student route conditions](https://www.gov.uk/guidance/immigration-rules/immigration-rules-appendix-student)
 के अंतर्गत है, जो सीमित परिस्थितियों में ही self-employment या business activity की अनुमति देता है। संभावित किसी conflict से बचने हेतु, जब यह स्थिति लागू हो, मालिक परियोजना-संबंधित donation या tip स्वीकार नहीं कर सकता.

<details>
<summary><strong>Student-route context, independent nonprofits, and donation boundaries</strong></summary>

जो पाठक संबंधित सार्वजनिक हित कार्य का समर्थन करना चाहें, वे सीधे किसी स्वतंत्र nonprofit को donate कर सकते हैं:

- [International Rescue Committee UK](https://help.rescue-uk.org/donate-web)
  उन लोगों की मदद करता है जो conflict और आपदा से प्रभावित हैं, जिनमें United Kingdom में अपने जीवन का पुनर्निर्माण कर रहे refugees भी शामिल हैं। व्यापक International Rescue Committee
  साथ ही [Claude Corps](https://www.anthropic.com/news/claude-corps) के लिए nonprofit partner के रूप में काम करता है.
- [CodePath](https://www.every.org/codepath) मुफ्त तकनीकी शिक्षा देता है
  और Anthropic के nonprofit partner के रूप में
  [Claude Corps](https://www.anthropic.com/news/claude-corps) के साथ काम करता है.

इन लिंक से सीधे तीसरे पक्ष के पास जाते हैं। Claude Aura और इसके मालिक किसी भी donation को collect, process, control, receive या financially benefit नहीं करते। संगठन अपना donation processing और receipts खुद संभालते हैं। इनका उल्लेख affiliation, sponsorship, endorsement, या Claude Aura के साथ official fundraising partnership का संकेत नहीं देता.

</details>

<a id="license-and-notices"></a>
## लाइसेंस और नोटिस

Project-authored software [MIT License](./LICENSE) के तहत वितरित होता है। साथ ही पढ़ें
[NOTICE.md](./NOTICE.md) और [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).

MIT License Anthropic के नाम, चिह्न, इंटरफ़ेस, वेबसाइट, या applications पर कोई अधिकार नहीं देता। Showcase captions से displayed UI, artwork, नाम, marks, या human likenesses पर reuse अधिकार नहीं मिलते। फ़ाइल-विशिष्ट स्रोत और rights notices लागू रहते हैं.

Anthropic के वर्तमान
[Trademark Guidelines](https://www.anthropic.com/legal/trademark-guidelines)
और [Consumer Terms](https://www.anthropic.com/terms) देखें। सुरक्षित नाम, marks, interface captures, artwork, या पहचान योग्य likenesses प्रकाशित करने, बदलने, या पुनर्वितरित करने से पहले संबंधित rightsholder से अनुमति लें। यह repository और README वह अनुमति नहीं देते.

<a id="acknowledgments"></a>
## आभार

- [Codex Dream Skin](https://github.com/Fei-Away/Codex-Dream-Skin) ने शुरुआती loopback validation workflow और approachable showcase pattern को प्रभावित किया।
- [claude-desktop-bin](https://github.com/patrickjaja/claude-desktop-bin) ने शुरुआती semantic theme mapping को प्रभावित किया।
- [Best README Template](https://github.com/othneildrew/Best-README-Template) ने इस README की reader-first संरचना को प्रभावित किया।
- Microsoft Edge WebView2 embedded browser runtime प्रदान करता है.

Detailed licenses और provenance [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md) में दर्ज हैं। Acknowledgment का अर्थ affiliation, sponsorship, या endorsement नहीं होता.

<p align="right">(<a href="#readme-top">शीर्ष पर वापस</a>)</p>
