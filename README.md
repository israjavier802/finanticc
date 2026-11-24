# FinanTic 1.1

Aplicación web instalable (PWA) para administrar finanzas personales.
Lions Vanguard Solutions · Instituto Tecnológico de Puebla.

## Qué hace

- **Registro e inicio de sesión con PIN de 4 dígitos (obligatorio).** La primera vez se crea el perfil (nombre + PIN); después la app pide el PIN cada vez que se abre.
- **Base de datos local (IndexedDB) cifrada** con AES-256. El PIN nunca se guarda.
- **Bloqueo automático** tras 3 minutos sin uso o al salir de la app más de 30 segundos. Botón de candado para bloquear a mano.
- **Protección contra intentos:** después de 5 PIN incorrectos hay que esperar 30 s (el tiempo se duplica con cada error adicional).
- Registro de ingresos y gastos (monto, categoría, fecha, nota), edición y eliminación.
- Movimientos por día, mes, año o periodo; filtro por tipo.
- Reportes: ingresos contra gastos, gastos por categoría, ingresos por fuente y tasa de ahorro.
- Presupuestos mensuales por categoría con aviso al 80 % y al 100 %.
- **Respaldo cifrado como archivo** (guardar o compartir) y restauración con el PIN del respaldo.
- **Cambio de PIN** (vuelve a cifrar toda la información).
- **Aviso de privacidad** y **guía de uso** dentro de la app.
- Funciona **sin internet** y se instala en Android e iPhone.
- Si el celular tenía datos de la versión 1.0, se importan y se cifran al crear el perfil.

## Estructura

```
index.html          Página principal (estructura de la app)
manifest.json       Nombre, colores e íconos para instalarla
sw.js               Service worker: guarda la app para abrir sin internet
css/estilos.css     Estilos (tema claro y oscuro)
js/utilidades.js    Fechas, formato de dinero, avisos
js/cifrado.js       Derivación de clave con el PIN (PBKDF2) y cifrado AES-GCM
js/basedatos.js     Base de datos IndexedDB: perfil, movimientos, ajustes
js/app.js           Pantallas: Inicio, Movimientos, Reportes, Presupuestos, Perfil
js/acceso.js        Registro, PIN, bloqueo, guía de uso y aviso de privacidad
js/inicio.js        Arranque de la app
img/                Íconos
```

### Base de datos (IndexedDB `finantic`)

| Almacén | Clave | Contenido |
|---|---|---|
| `perfil` | `id` = `'perfil'` | nombre, sal, iteraciones, verificador cifrado, intentos fallidos. **Sin datos financieros** |
| `movimientos` | `id` | `{ id, iv, ct }`: cada movimiento cifrado por separado |
| `ajustes` | `clave` | `categorias`, `presupuestos`, `preferencias`, cifrados |

Un movimiento, ya descifrado, tiene esta forma:

```json
{ "id": "lx3k9a", "tipo": "gasto", "categoria": "Comida", "monto": 150, "fecha": "2026-11-24", "nota": "Tacos", "creado": 1795000000000 }
```

### Cómo funciona el cifrado

1. Al crear el perfil se genera una **sal** aleatoria de 16 bytes.
2. Con el PIN y la sal se deriva una **clave AES-256** mediante **PBKDF2-SHA256 con 200,000 iteraciones**.
3. Cada registro se cifra con **AES-GCM** y un vector aleatorio (`iv`) propio.
4. Para verificar el PIN se intenta descifrar un "verificador". Si el PIN es incorrecto, el descifrado falla.
5. Al bloquear la app, la clave y los datos se borran de la memoria.

Se usa la criptografía integrada del navegador (Web Crypto API), sin librerías externas.

**Limitación a documentar:** un PIN de 4 dígitos tiene 10,000 combinaciones. Las 200,000 iteraciones y el límite de intentos hacen lento probarlas todas, pero una contraseña más larga sería más segura. Es un equilibrio entre seguridad y practicidad (requisito R6).

## Probar en la computadora

Abrir `index.html` con doble clic **no funciona**: el navegador solo permite el cifrado y la base de datos en `https` o en `localhost`. Usa un servidor local:

- **VS Code:** extensión *Live Server* → clic derecho en `index.html` → *Open with Live Server*.
- **Python:** en esta carpeta, `python -m http.server 8000`, y abre http://localhost:8000
- **XAMPP:** copia la carpeta a `htdocs/FinanTic` y abre http://localhost/FinanTic

## Publicar en GitHub Pages (gratis, con https)

1. Crea un repositorio en GitHub, por ejemplo `finantic`, y sube **el contenido de esta carpeta** (que `index.html` quede en la raíz del repositorio).
2. En el repositorio: **Settings → Pages**.
3. En *Build and deployment*, elige **Source: Deploy from a branch**, rama **main**, carpeta **/ (root)** y guarda.
4. En uno o dos minutos aparece la liga: `https://TU-USUARIO.github.io/finantic/`

## Instalar en el celular

Abre la liga **una vez con internet**:

- **Android (Chrome):** menú ⋮ → **Instalar app** (o *Agregar a pantalla principal*).
- **iPhone (Safari):** botón **Compartir** → **Agregar a pantalla de inicio**.

Después se abre desde su ícono, a pantalla completa y sin internet. Para comprobarlo, activa el modo avión y ábrela.

## Publicar una versión nueva

1. Sube los cambios a GitHub.
2. En `sw.js` cambia el nombre de la caché (por ejemplo `finantic-v1.2`).
3. Los celulares descargan la versión nueva la próxima vez que abran la app con internet.

## Datos y privacidad

- La información **no sale del dispositivo**: no hay servidor ni cuentas en línea.
- Si se borran los datos del navegador o se desinstala la app, la información se pierde. Por eso existe el **respaldo como archivo**.
- Si se olvida el PIN, la información no se puede recuperar (opción *¿Olvidaste tu PIN?* → borrar y crear perfil nuevo).
