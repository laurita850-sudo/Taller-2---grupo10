# Privacy Vault — Banco Andino

Prueba de concepto de un vault de privacidad. El servicio detecta nombres, correos y celulares colombianos, los reemplaza por tokens deterministas (`NAME_`, `EMAIL_`, `PHONE_`) y guarda la pareja dato/token en MongoDB Atlas. El endpoint `/secureChatGPT` envía a OpenAI solo el texto anonimizado y restaura únicamente los tokens de esa solicitud.

## Requisitos

- Node.js 22 o superior (lo exige el SDK `openai` 7.x)
- Una base MongoDB Atlas cuyo nombre en la URI sea `privacy_vault`
- Una API key de OpenAI, solo para `/secureChatGPT`

## Instalación

```bash
npm install
copy .env.example .env
```

En macOS o Linux el segundo comando es `cp .env.example .env`.

Edita `.env` en local y completa los valores. No lo subas al repositorio: `.gitignore` ya excluye `.env`.

| Variable | Uso |
|---|---|
| `PORT` | Puerto HTTP. Por defecto `3001`. |
| `MONGO_URI` | Cadena de Atlas. Debe incluir la base `privacy_vault`. |
| `TEST_MONGO_URI` | Solo para `npm test`. Debe apuntar exactamente a la base `privacy_vault_test`. |
| `VAULT_SECRET` | Secreto HMAC de los tokens. Si falta, el proceso usa un valor solo de prueba. |
| `OPENAI_API_KEY` | Clave del SDK oficial de OpenAI. |
| `OPENAI_MODEL` | Modelo de chat. Por defecto `gpt-4o-mini`. |

En Atlas, el Network Access del cluster debe permitir la IP desde la que corre el servidor.

## Ejecución

```bash
npm start
```

El desarrollo con recarga es `npm run dev`. Las pruebas son `npm test`.

Las pruebas de `/anonymize` y `/deanonymize` borran los registros de su base antes de cada caso, así que usan solo `TEST_MONGO_URI` y nunca `MONGO_URI`. Tres controles protegen la base `privacy_vault`:

1. Antes de conectar, las pruebas se detienen si `TEST_MONGO_URI` falta, es igual a `MONGO_URI` o no apunta exactamente a `privacy_vault_test`.
2. Después de conectar, se detienen si la base seleccionada no es `privacy_vault_test`.
3. `resetVault()` se niega a borrar en cualquier base distinta de `privacy_vault_test`.

Las pruebas de estos controles y las de `/secureChatGPT` usan datos ficticios y dobles del modelo: no se conectan a Atlas ni llaman a OpenAI.

## Endpoints

Todos aceptan `Content-Type: application/json`.

### `POST /anonymize`

```bash
curl -X POST http://localhost:3001/anonymize -H "Content-Type: application/json" -d "{\"message\":\"oferta de trabajo para Ana Perez con email ana.perez@example.com y teléfono 3001234567\"}"
```

Respuesta: `{ "anonymizedMessage": "..." }`.

### `POST /deanonymize`

Restaura cualquier token que ya exista en el vault.

```bash
curl -X POST http://localhost:3001/deanonymize -H "Content-Type: application/json" -d "{\"anonymizedMessage\":\"oferta de trabajo para NAME_0123456789ab con email EMAIL_0123456789ab y teléfono PHONE_0123456789ab\"}"
```

Respuesta: `{ "message": "..." }`. Un token desconocido se deja igual.

### `POST /secureChatGPT`

Anonimiza el prompt, lo envía a OpenAI y desanonimiza la respuesta.

```bash
curl -X POST http://localhost:3001/secureChatGPT -H "Content-Type: application/json" -d "{\"prompt\":\"Redacta un saludo corto para Ana Perez, ana.perez@example.com, cel 3001234567\"}"
```

Respuesta: `{ "response": "..." }`.

Solo se restauran los tokens generados para ese prompt. Si el modelo escribe un token de otra persona que ya esté en MongoDB, ese token permanece sin revelar.

Errores de este endpoint:

| HTTP | Causa |
|---|---|
| 400 | Falta `prompt` o no es un texto con contenido. |
| 502 | OpenAI no respondió con un texto utilizable. |
| 503 | Falta `OPENAI_API_KEY`. |
| 500 | Falló el vault u otro error interno. |

### Probar desde PowerShell en Windows

En Windows PowerShell, `curl` es un alias de `Invoke-WebRequest` y no acepta los comandos anteriores. Usa Git Bash o `Invoke-RestMethod`:

```powershell
$body = '{"prompt":"Redacta un saludo corto para Ana Perez, ana.perez@example.com, cel 3001234567"}'
Invoke-RestMethod -Method Post -Uri http://localhost:3001/secureChatGPT -ContentType 'application/json; charset=utf-8' -Body ([Text.Encoding]::UTF8.GetBytes($body))
```

## Estructura

```text
src/index.js                  servidor Express y conexión a Atlas
src/routes/anonymize.js
src/routes/deanonymize.js
src/routes/secureChatGPT.js
src/services/piiDetector.js   regex de nombre, correo y celular
src/services/anonymizer.js    reemplazo y restauración de tokens
src/services/vault.js         lectura y escritura en MongoDB
src/services/openaiService.js cliente del SDK oficial
src/services/secureChat.js    anonimizar, completar y restaurar
src/models/VaultEntry.js
src/db/connection.js          conexión y validación de la base de pruebas
```

Los prompts usados durante el taller están en `PROMPTS.md`.
