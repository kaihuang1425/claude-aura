<a id="readme-top"></a>

# Claude Aura

<p align="center">
  <a href="../README.md">English</a> ·
  <a href="./README.zh-CN.md">简体中文</a> ·
  <a href="./README.zh-HKTW.md">繁體中文</a> ·
  <a href="./README.hi.md">हिन्दी</a> ·
  <strong>Español</strong> ·
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
  <strong>Da a la web en vivo de Claude un tema personal, reversible y local en Windows.</strong><br>
  Temas locales · Sin parcheo de Claude Desktop · Recuperar el aspecto original con un clic
</p>

<p align="center">
  <a href="#getting-started">Primeros pasos</a> ·
  <a href="#theme-showcase">Ver temas</a> ·
  <a href="#create-a-custom-theme">Crear un tema</a> ·
  <a href="../docs/TROUBLESHOOTING.md">Solución de problemas</a> ·
  <a href="./SECURITY.md">Seguridad</a>
</p>

<p align="center">
  <a href="https://github.com/kaihuang1425/claude-aura"><strong>Si Claude Aura te resulta útil, dale una estrella al proyecto en GitHub.</strong></a>
</p>

<p align="center">
  <img src="../docs/readme-showcase/japanese-film-editorial-dark-new-chat.png"
       alt="Japanese Film Editorial dark new-chat reference preview"
       width="900"><br>
  <sub>Oscuro · Nueva conversación · muestra de documentación aportada por usuarios</sub>
</p>

<p align="center"><sub>Vista de referencia · no es un fondo de tema importable ni evidencia de aceptación en vivo</sub></p>

> **Independent project.** Claude Aura es un proyecto independiente y no está afiliado,
> respaldado, patrocinado ni aprobado por Anthropic PBC. Aura muestra
> el sitio web en vivo en `claude.ai`; no ofrece Claude ni modifica
> las aplicaciones instaladas de Anthropic. Claude, Anthropic y los nombres
> y marcas relacionados pertenecen a Anthropic PBC. La licencia del proyecto
> no concede derechos sobre ese material.

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
<summary><strong>Contenido</strong></summary>

- [Claude Aura](#claude-aura)
  - [Por qué Aura](#why-aura)
  - [Inicio rápido](#quick-start)
    - [Requisitos](#requirements)
    - [Instalación](#installation)
    - [Desinstalar](#uninstall)
  - [Demostración de temas](#theme-showcase)
    - [Japanese Film Editorial](#japanese-film-editorial)
    - [Japanese Idol](#japanese-idol)
    - [Korean Idol](#korean-idol)
  - [Usar Aura](#use-aura)
  - [Crear un tema personalizado](#create-a-custom-theme)
  - [Cómo funciona Aura](#how-aura-works)
  - [Seguridad y privacidad](#safety-and-privacy)
  - [Hoja de ruta](#roadmap)
  - [Soporte y documentación](#support-and-documentation)
    - [Mapa de documentación](#documentation-map)
  - [Apoyo solidario](#charitable-support)
  - [Licencia y avisos](#license-and-notices)
  - [Agradecimientos](#acknowledgments)

</details>
<a id="about-claude-aura"></a>
<a id="why-aura"></a>
## Por qué Aura

- **Usa el sitio real de Claude.** Aura conserva la interfaz real y los controles nativos en lugar de sustituirlos por una pantalla reconstruida.
- **Mantén el cambio local y reversible.** Aplica estilos locales sin parchear Claude Desktop, y **Original look** elimina la capa de presentación de Aura con un clic.
- **Empieza con ocho temas integrados.** Cada uno está disponible como punto de partida estable y de solo lectura para personalizar tu espacio.
- **Crea temas sin sobrescribir los originales.** Claude Aura Studio soporta colores locales, tipografías, formas, efectos y arte.

Aura 0.3 actualmente solo aplica temas al sitio en vivo. Aún no modifica
Claude Desktop Code ni el terminal de Claude Code, y el chat normal dentro de Aura
no obtiene acceso a proyectos locales. Antes del lanzamiento final, Aura Code
debe aprobar una verificación bloqueante de release con una sesión oficial de
[Remote Control](https://code.claude.com/docs/en/remote-control) con tema en
`claude.ai/code`; la exportación de terminal-theme para entornos restringidos
se realiza sin parchear Claude Desktop.

<details>
<summary><strong>Capacidades y exclusiones completas</strong></summary>

Claude Aura abre el sitio real `claude.ai` en una ventana dedicada de Microsoft Edge
WebView2 y aplica un tema visual local. Está pensado para quien quiere un
espacio de trabajo más personal sin parchear Claude Desktop ni reemplazar la
interfaz en vivo con una captura.

| Aura hace | Aura no hace |
| --- | --- |
| Carga la interfaz en vivo de `claude.ai` en WebView2 | Reemplazar Claude con una interfaz reconstruida |
| Aplica estilos locales reversibles | Parchear Claude Desktop, `app.asar`, paquetes de Windows o firmas de código |
| Incluye ocho temas integrados | Cambiar cuentas, chats, claves API, modelos o ajustes del proveedor |
| Proporciona Studio para temas personalizados locales | Presentarse como producto de Anthropic o sistema oficial de temas |
| Ofrece **Original look** dentro de la app | Borrar temas guardados al desactivar el estilo |

</details>

<p align="right">(<a href="#readme-top">volver al inicio</a>)</p>
<a id="getting-started"></a>
## Inicio rápido

<a id="requirements"></a>
### Requisitos

- Windows 10 o Windows 11
- Acceso a Internet y cuenta de Claude
- [Node.js 22 o superior](https://nodejs.org/en/download)
- [Microsoft Edge WebView2 Runtime](https://developer.microsoft.com/en-us/microsoft-edge/webview2/)

WebView2 está presente en la mayoría de ordenadores actuales con Windows. Si Aura no
puede abrir su ventana del navegador, instala o repara Evergreen WebView2 Runtime y
vuelve a intentarlo. Claude Desktop es opcional y permanece como aplicación separada.

<a id="installation"></a>
### Instalación

Abra la [última versión](https://github.com/kaihuang1425/claude-aura/releases) y elija una de estas rutas. Ambas instalan la misma versión para la cuenta actual de Windows.

| Ruta | Úselo cuando | Descargar |
| --- | --- | --- |
| **Setup sin firmar** | Quiere el instalador guiado más simple y Windows lo abre normalmente | `Claude-Aura-Setup-v<version>-UNSIGNED.exe` junto con su `.sha256` y `.manifest.json` |
| **ZIP + CMD fallback** | Windows advierte o bloquea el Setup sin firmar, o prefiere scripts fuente legibles | `claude-aura-v<version>.zip` junto con su `.sha256` |

#### Ruta 1 ??Unsigned Setup

1. En **Assets**, descargue `-UNSIGNED.exe`, su `.sha256` y su `.manifest.json`. No use los archivos de **Source code** automáticos de GitHub.
2. Compare el SHA-256 del archivo Setup con ambos archivos complementarios. Deténgase y elimine las descargas si algún valor difiere.
3. Windows no puede verificar el publisher de este instalador porque el desarrollador no tiene un certificado de firma de código. Si Windows advierte o lo bloquea, no ignore la advertencia; use la Ruta 2.
4. Si se abre normalmente, siga Setup. Comprueba Node.js y WebView2, instala debajo de `%LOCALAPPDATA%\ClaudeAura`, añade registro en **Installed apps** y accesos directos, y luego abre Aura.

#### Ruta 2 ??ZIP + CMD fallback

1. En **Assets**, descargue `claude-aura-v<version>.zip` y su `.sha256` correspondiente. No use los archivos de **Source code** automáticos de GitHub.
2. Compare el SHA-256 del ZIP con el archivo complementario. Deténgase y elimine ambos archivos si los valores difieren.
3. Seleccione **Extract all**. En la carpeta `claude-aura` extraída, haga doble clic en **Install Claude Aura.cmd**. No lo ejecute desde la vista previa del ZIP.
4. El instalador CMD/PowerShell legible verifica Node.js y WebView2, instala Aura, crea accesos directos y lo abre. Esta ruta no tiene identidad de publisher Authenticode y no añade una entrada **Installed apps**.

Después de cualquiera de las rutas, inicie sesión en Aura si `claude.ai` se lo solicita. Haga clic en el botón flotante de Aura, elija **Open Studio** y luego **Themes**.

Un recurso llamado `Claude-Aura-Setup-v<version>.exe` sin `-UNSIGNED` es una ruta firmada distinta y debe mostrar el publisher indicado en las notas de esa release. Un recurso que termine en `-UNSIGNED-DEV.exe` nunca es público.

La instalación no parchea ni reemplaza Claude Desktop.

<details>
<summary><strong>Comportamiento del instalador, ubicación de la aplicación y desinstalación</strong></summary>

Ambas rutas se ejecutan sin pedir administrador, validan los prerrequisitos y realizan el intercambio protegido del árbol de la app de Aura. Los archivos de la aplicación se instalan en:

```text
%LOCALAPPDATA%\ClaudeAura\app
```

Crea accesos directos de **Claude Aura**, **Claude Aura Studio** y desinstalación en el menú Inicio y en el escritorio. Los ajustes de tema y los datos de inicio de sesión se almacenan separadamente de la aplicación, por lo que reinstalar Aura no los reemplaza silenciosamente. El Setup nativo añade una entrada de **Installed apps** y un desinstalador nativo; la ruta ZIP/CMD conserva su acceso directo de desinstalación de script fuente.

Los desarrolladores pueden clonar el repositorio y compilar el instalador de desarrollo sin firmar con nombre explícito para inspección local. Es distinto del Setup público sin firmar claramente marcado. Los comandos de compilación, el compilador pinned, las puertas de verificación y la checklist de lanzamiento están documentados en la
[Windows installer guide](../docs/WINDOWS_INSTALLER.md).

### Desinstalar

Primero haga clic con el botón derecho en el botón flotante de Aura y seleccione **Exit Claude Aura**.
Para una instalación ZIP, abra **Start > Claude Aura > Uninstall Claude Aura** o haga doble clic en **Uninstall Claude Aura.cmd** de un release extraído. Para cualquiera de los dos Setups nativos, también puede usar **Settings > Apps > Installed apps > Claude Aura > Uninstall**. La entrada `.cmd` delega al desinstalador nativo registrado cuando existe. El desinstalador se niega a continuar mientras Aura siga abierto.

Por defecto, desinstalar elimina la aplicación Aura y sus accesos directos, pero conserva la configuración local de tema y el perfil de inicio de sesión WebView separado de Aura para una reinstalación posterior. El desinstalador también pregunta antes de eliminar esas carpetas. Esa borrado opcional elimina la sesión de inicio de sesión local de Aura; nunca elimina Claude Desktop, la cuenta Anthropic del usuario o los datos de cuenta del lado del servidor.

</details>
<p align="right">(<a href="#readme-top">volver al inicio</a>)

<a id="theme-showcase"></a>
## Muestra de temas

Aura muestra su sistema visual a través de referencias de New chat y Conversation. La vista previa de Japanese Film Editorial en New chat aparece al principio de este README.

**Default · Japanese Film Editorial · Korean Prestige · Cartoon Studio · Anime Twilight · Study Library · Japanese Idol · Korean Idol**

<a id="japanese-film-editorial"></a>
### Japanese Film Editorial

Papel cálido, tinta carboncillo, añil tenue y bermellón contenido.

<details>
<summary>Ver la vista Conversation</summary>

<p align="center">
  <img src="../docs/readme-showcase/japanese-film-editorial-dark-conversation.png"
       alt="Japanese Film Editorial dark conversation reference preview"
       width="900"><br>
  <sub>Oscuro · Conversación · muestra de documentación aportada por usuarios</sub>
</p>

</details>

<a id="japanese-idol"></a>
### Japanese Idol

Crema cálida, blush, rosa, lila nacarada y detalles finos de cinta.

<p align="center">
  <img src="../docs/readme-showcase/japanese-idol-light-new-chat.png"
       alt="Japanese Idol light new-chat reference preview"
       width="900"><br>
  <sub>Claro · Nueva conversación · muestra de documentación aportada por usuarios</sub>
</p>

<details>
<summary>Ver la vista Conversation</summary>

<p align="center">
  <img src="../docs/readme-showcase/japanese-idol-light-conversation.png"
       alt="Japanese Idol light conversation reference preview"
       width="900"><br>
  <sub>Claro · Conversación · muestra de documentación aportada por usuarios</sub>
</p>

</details>

<a id="korean-idol"></a>
### Korean Idol

Blanco frío, periwinkle, plata holográfica y vidrio musical estructurado.

<p align="center">
  <img src="../docs/readme-showcase/korean-idol-light-new-chat.png"
       alt="Korean Idol light new-chat reference preview"
       width="900"><br>
  <sub>Claro · Nueva conversación · muestra de documentación aportada por usuarios</sub>
</p>

<details>
<summary>Ver la vista Conversation</summary>

<p align="center">
  <img src="../docs/readme-showcase/korean-idol-light-conversation.png"
       alt="Korean Idol light conversation reference preview"
       width="900"><br>
  <sub>Claro · Conversación · muestra de documentación aportada por usuarios</sub>
</p>

</details>

<details>
<summary><strong>Estado de referencia y límites de reutilización</strong></summary>

> **Estado de referencia:** Estas imágenes aportadas por usuarios comunican la
> dirección visual prevista. Pueden incluir contenido ilustrativo de interfaz y no
> son evidencia de aceptación en vivo ni prueba del comportamiento actual de
> `claude.ai`. No son fondos de tema, no deben importarse en Aura y se excluyen
> de los instaladores de release.
>
> Las vistas previas contienen UI de terceros, nombres o marcas y arte de retratos
> con similitud humana. Su inclusión no otorga derechos de reutilización.
> Confirma los derechos de interfaz, marca, arte y derechos de imagen antes de
> cualquier publicación o redistribución posterior.

</details>

<a id="built-in-themes"></a>
<details>
<summary><strong>Todos los temas integrados y IDs estables</strong></summary>

Aura incluye ocho temas integrados en un orden estable:

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

Los temas integrados son de solo lectura. Studio crea una copia editable cuando
quieres personalizar uno.

</details>

<p align="right">(<a href="#readme-top">volver al inicio</a>)</p>
<a id="use-aura"></a>
## Usar Aura

| Acción | Qué hace |
| --- | --- |
| Hacer clic en el botón flotante de Aura | Abre Claude Aura Studio |
| **Themes** | Abre la galería integrada y guarda el tema seleccionado |
| **Create a theme** | Crea o edita un tema personalizado propio de Aura |
| **Personal wallpaper > Choose wallpaper*** | Selecciona una imagen local separada del tema activo |
| **Clear wallpaper** | Deja de usar el wallpaper sin borrar su archivo original |
| **Original look** | Quita el estilo de Aura y muestra el sitio en vivo sin el tema seleccionado |
| **Apply theme** | Restaura el tema Aura guardado tras el Original look |
| **Open desktop app** | Abre Claude Desktop sin modificarlo |

El tema seleccionado persiste entre reinicios de Aura. **Original look** desactiva la
capa de presentación de Aura; no borra los temas guardados ni el arte personalizado.
**Default** es el primer tema integrado de Aura; no equivale al Original look.

El lanzador flotante de Aura permanece como un control circular compacto. Haz clic para
abrir Studio, arrástralo para moverlo o haz clic con el botón derecho para abrir el
menú de Aura.

El wallpaper personal permanece vinculado a la ruta de la imagen original. Mover o
eliminar ese archivo lo hace inaccesible. La obra de arte importada mediante el editor
sigue otro camino: Studio la copia o convierte en carpetas temáticas propias de Aura.

<p align="right">(<a href="#readme-top">volver al inicio</a>)</p>

<a id="create-a-custom-theme"></a>
## Crear un tema personalizado

1. Abre **Claude Aura Studio** desde el escritorio o el menú Inicio.
2. Abre **Create a theme** y selecciona **Customize Default**, o abre **Themes**,
   elige un tema integrado y selecciona **Duplicate to customize**.
3. Ajusta colores claros y oscuros, tipografía, formas, efectos y arte local.
4. Revisa los diseños de New chat y Conversation en la vista previa de Studio.
5. Resuelve cualquier advertencia de contraste o tamaño de archivo.
6. Selecciona **Save theme**.

Los archivos integrados nunca se sobrescriben. Si un borrador queda inválido, sigue
siendo editable mientras Aura continúe mostrando la última versión válida.

El arte PNG, JPEG, WebP o AVIF importado se convierte localmente a recursos WebP con
presupuestos definidos. Studio no guarda la ruta fuente dentro del tema. Para el
editor completo y el contrato del tema, consulta la
[Theme Kit Specification](../docs/THEME_KIT_SPEC.md).

Cuando esté disponible, Studio puede usar una captura de la ventana real de Aura como
fondo de edición. Esa captura puede contener contenido de conversación, permanece en
memoria solo durante la sesión actual y nunca se escribe en disco.

<p align="right">(<a href="#readme-top">volver al inicio</a>)</p>

<a id="built-with"></a>
<a id="how-aura-works"></a>
## Cómo funciona Aura

| Parte | Propósito |
| --- | --- |
| Windows PowerShell y WinForms | Instalador, ventana de Aura, Studio, accesos directos y controles locales |
| Microsoft Edge WebView2 | Muestra el sitio real `claude.ai` |
| Node.js 22+ | Valida temas y compila el estilo local |
| HTML, CSS, JavaScript, SVG y WebP locales | Proporciona el estilo de Aura y recursos de temas integrados |

El proyecto no tiene dependencias de paquetes npm ni fuentes remotas en tiempo de ejecución.

<p align="right">(<a href="#readme-top">volver al inicio</a>)</p>

<a id="safety-and-privacy"></a>
## Seguridad y privacidad

- Aura carga el sitio HTTPS en vivo `claude.ai` en Microsoft Edge WebView2.
- Las páginas del proveedor de inicio de sesión no se tematizan.
- Aura no abre un puerto de remote-debugging ni parchea Claude Desktop.
- Los archivos de tema y arte importado permanecen en carpetas locales de Aura.
- La página en vivo sigue conectando con Anthropic normalmente.
- El perfil WebView contiene datos de sesión y debe protegerse.
- Las capturas de Studio en vivo permanecen en memoria durante la sesión de edición y no se guardan en disco.
- No selecciones un fondo sensible; la página en vivo puede acceder técnicamente
  a datos DOM dentro de su propio proceso.
- El uso del servicio vivo sigue los [Consumer Terms](https://www.anthropic.com/terms)
  y [Usage Policy](https://www.anthropic.com/legal/aup) vigentes de Anthropic.

Lee [SECURITY.md](./SECURITY.md) para el límite de confianza y
[Troubleshooting](../docs/TROUBLESHOOTING.md) para ayuda de inicio de sesión,
la carga, tema, imagen y WebView2.

<a id="local-data"></a>
<details>
<summary><strong>Carpetas locales y retención al desinstalar</strong></summary>

Aura separa su aplicación, ajustes, temas, borradores y perfil de navegador:

| Ruta | Contenido |
| --- | --- |
| `%LOCALAPPDATA%\ClaudeAura\app` | Aplicación de Aura instalada |
| `%LOCALAPPDATA%\ClaudeAura\data` | Ajustes, logs y estado local propio de Aura |
| `%LOCALAPPDATA%\ClaudeAura\data\themes` | Temas personalizados guardados y arte derivado |
| `%LOCALAPPDATA%\ClaudeAura\data\theme-drafts` | Borradores en curso de Studio |
| `%LOCALAPPDATA%\ClaudeAura\webview` | Perfil de sesión WebView2 de Aura |

Trata la carpeta `webview` como cualquier otro perfil de navegador con sesión iniciada.
No la publiques ni la compartas. La desinstalación por defecto conserva `data` y
`webview`; usa la opción de eliminación explícita solo si también quieres borrar
ajustes locales, temas y el perfil de sesión separado.

</details>

<p align="right">(<a href="#readme-top">volver al inicio</a>)</p>
<a id="roadmap"></a>
## Hoja de ruta

- [x] Compañero dedicado de Windows WebView2 y **Original look** reversible
- [x] Ocho temas integrados estables con soporte Light y Dark
- [ ] **P0** Completar y aprobar Aura Code para Remote Control local oficial de Claude Code con terminal-theme export coincidente
- [ ] Completar y revisar el editor visual no-code de Studio
- [ ] Publicar el tutorial de tema personalizado de 30 minutos
- [ ] Ejecutar la verificación final previa al lanzamiento

Consulta el
[reporte de implementación](../docs/IMPLEMENTATION_REPORT.md) y los
[incidencias del repositorio](https://github.com/kaihuang1425/claude-aura/issues)
para el estado público. Una vista de referencia no sustituye la evidencia en vivo
a exigencia de aceptación.

<p align="right">(<a href="#readme-top">volver al inicio</a>)</p>

<a id="support"></a>
## Soporte y documentación

Empieza con [Troubleshooting](../docs/TROUBLESHOOTING.md). Para un error reproducible o
solicitud de funcionalidad, usa la
[página de Issues](https://github.com/kaihuang1425/claude-aura/issues).

Al reportar un problema, incluye versiones de Windows, Node.js y WebView2, el tema
activo ID y los pasos para reproducirlo. Revisa los registros antes de compartirlos;
el log de UI de Aura se guarda en:

```text
%LOCALAPPDATA%\ClaudeAura\data\aura-ui.log
```

Reporta problemas de seguridad mediante un advisory privado del repositorio, como
se describe en [SECURITY.md](./SECURITY.md).

<a id="documentation-map"></a>
### Mapa de documentación

- [Troubleshooting](../docs/TROUBLESHOOTING.md)
- [Security and trust boundary](./SECURITY.md)
- [Theming guide](../docs/THEMING.md)
- [Theme Kit Specification](../docs/THEME_KIT_SPEC.md)
- [Implementation report](../docs/IMPLEMENTATION_REPORT.md)
- [File Manifest](../docs/FILE_MANIFEST.md)
- [Contributing guide](./CONTRIBUTING.md)
- [Repository issues](https://github.com/kaihuang1425/claude-aura/issues)

<a id="contributing"></a>
<details>
<summary><strong>Comprobaciones y límites del proyecto</strong></summary>

Ejecuta las comprobaciones requeridas antes de enviar cambios:

```powershell
npm run check
npm run verify:cycle
```

Para una auditoría de un único tema integrado:

```powershell
node scripts/theme-cli.mjs qa <id>
```

Mantén intactas estas fronteras de proyecto:

- No agregar dependencias npm ni fuentes en tiempo de ejecución.
- Mantener fijos los ocho IDs de temas y su orden.
- No distribuir HTML reconstruido de la interfaz de Claude como contenido de producto.
- No presentar imágenes de referencia como evidencia de aceptación de UI.
- Incluir información de origen, licencia y distribución para los medios aportados.

Consulta [CONTRIBUTING.md](./CONTRIBUTING.md), la
[guía de tematización](../docs/THEMING.md), la
[Theme Kit Specification](../docs/THEME_KIT_SPEC.md) y el
[File Manifest](../docs/FILE_MANIFEST.md) antes de cambiar el sistema de temas
o el árbol de release.

</details>

<p align="right">(<a href="#readme-top">volver al inicio</a>)</p>

<a id="charitable-support"></a>
## Apoyo solidario

Claude Aura no acepta donaciones personales, propinas, patrocinios, pagos por referencia
ni otro apoyo financiero. El propietario se encuentra actualmente en el Reino Unido
bajo [condiciones de Student route](https://www.gov.uk/guidance/immigration-rules/immigration-rules-appendix-student),
que prohíben actividades de negocio o autónomas salvo circunstancias limitadas.
Para evitar conflictos con esas condiciones, el propietario no puede aceptar
donaciones o propinas vinculadas al proyecto mientras se apliquen.

[Si Claude Aura te resulta útil, la forma más sencilla y sin coste de apoyarlo es ponerle una estrella al repositorio en GitHub.](https://github.com/kaihuang1425/claude-aura)

<details>
<summary><strong>Contexto de Student route, organizaciones sin ánimo de lucro y límites de donación</strong></summary>

Los lectores que deseen apoyar trabajos de interés público pueden donar directamente
a una de estas organizaciones independientes:

- [International Rescue Committee UK](https://help.rescue-uk.org/donate-web)
  ayuda a personas afectadas por conflictos y desastres, incluidos refugiados
  que reconstruyen su vida en el Reino Unido. El International Rescue Committee más
  amplio también participa en [Claude Corps](https://www.anthropic.com/news/claude-corps)
  como partner nonprofit.
- [CodePath](https://www.every.org/codepath) ofrece educación técnica gratuita
  y trabaja con Anthropic como partner sin ánimo de lucro de
  [Claude Corps](https://www.anthropic.com/news/claude-corps).

Estos enlaces van directamente a terceros. Claude Aura y su propietario no recogen,
procesan, controlan, reciben o se benefician financieramente de ninguna donación.
Cada organización gestiona su propio proceso de pago y recibos. Su aparición no implica
afiliación, patrocinio, aprobación o asociación oficial de recaudación con Claude Aura.

</details>

<a id="license-and-notices"></a>
## Licencia y avisos

El software del proyecto se distribuye bajo la
[MIT License](./LICENSE). También consulta
[NOTICE.md](./NOTICE.md) y [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).

La MIT License no concede derechos sobre nombres, marcas, interfaz, web o aplicaciones
de Anthropic. Los subtítulos de muestra no otorgan derechos de reutilización para la
UI mostrada, arte, nombres, marcas o semejanzas humanas. Las notificaciones de fuente
específicas y derechos por archivo siguen aplicándose.

Revisa los actuales
[Anthropic Trademark Guidelines](https://www.anthropic.com/legal/trademark-guidelines)
y [Consumer Terms](https://www.anthropic.com/terms). Obtén el permiso requerido
antes de publicar, modificar o redistribuir nombres, marcas, capturas de interfaz,
arte o semejanzas reconocibles protegidas. Este repositorio y el README no conceden
ese permiso.

<a id="acknowledgments"></a>
## Agradecimientos

- [Codex Dream Skin](https://github.com/Fei-Away/Codex-Dream-Skin) inspiró el
  flujo de validación loopback original y el patrón de muestra accesible.
- [claude-desktop-bin](https://github.com/patrickjaja/claude-desktop-bin) inspiró
  la asignación semántica inicial de temas.
- [Best README Template](https://github.com/othneildrew/Best-README-Template) inspiró
  la estructura centrada en el lector de este README.
- Microsoft Edge WebView2 proporciona el runtime del navegador embebido.

Las licencias detalladas y la procedencia están registradas en
[THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md). El reconocimiento no implica
afiliación, patrocinio ni aprobación.

<p align="right">(<a href="#readme-top">volver al inicio</a>)</p>
