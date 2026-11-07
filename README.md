# Cookie 

Extensión para Chrome, Edge y Brave (Manifest V3) que permite ver, copiar, borrar, exportar e importar las cookies del sitio que tienes abierto.

## Funciones

- Lista las cookies del sitio actual con su dominio, ruta, expiración y flags (`Secure`, `HttpOnly`, `SameSite`).
- Búsqueda por nombre o por valor.
- Copiar el valor de una cookie.
- Borrar una cookie o todas las del sitio.
- Exportar las cookies a JSON (se copia al portapapeles).
- Importar cookies desde un JSON.

## Instalación

La extensión no está en la tienda de Chrome, así que se instala manualmente:

1. Descarga o clona este repositorio.
2. Abre `chrome://extensions` (o `edge://extensions`).
3. Activa el **Modo de desarrollador**.
4. Pulsa **Cargar descomprimida** y selecciona la carpeta del proyecto.
5. Fija la extensión en la barra del navegador.

## Uso

1. Abre un sitio web (`http` o `https`) y pulsa el ícono de la extensión.
2. Usa el buscador para filtrar y los botones de cada cookie para copiar su valor o borrarla.
3. **Exportar** copia todas las cookies del sitio como JSON.
4. **Importar** abre un cuadro donde pegas el JSON; las cookies se aplican al navegador. Recarga la página después para que surtan efecto.

### Formato de importación

```json
[
  {
    "name": "ejemplo",
    "value": "valor",
    "domain": ".ejemplo.com",
    "path": "/",
    "secure": true,
    "httpOnly": false,
    "sameSite": "lax",
    "expirationDate": 1893456000
  }
]
```

Notas:

- `sameSite` acepta `no_restriction`, `lax`, `strict` o `unspecified` (también `None`, `Lax` y `Strict`).
- `expirationDate` va en segundos. Las cookies de sesión pueden omitirlo, o usar `-1` o `0`.
- Las cookies cuya fecha ya pasó se omiten, porque el navegador no permite crearlas.
- `SameSite=None` requiere `Secure`.
- Las cookies con prefijo `__Host-` o `__Secure-` requieren `Secure`.

## Permisos

| Permiso | Para qué se usa |
| --- | --- |
| `cookies` y `<all_urls>` | Leer y modificar las cookies del sitio abierto |
| `activeTab` y `tabs` | Saber cuál es la pestaña actual |

Todo funciona de forma local. La extensión no envía datos a ningún servidor.

## Seguridad

Las cookies de sesión funcionan como una llave de acceso a tu cuenta. No compartas JSON exportados con nadie y no pegues cookies que te haya dado otra persona sin saber de dónde vienen.

## Estructura

```
├── manifest.json
├── popup.html
├── popup.css
├── popup.js
└── icon/
    ├── icon16.png
    ├── icon32.png
    ├── icon48.png
    └── icon128.png
```
