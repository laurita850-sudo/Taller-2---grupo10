# Prompts del Taller 2

Registro de los prompts usados para construir el Privacy Vault. Las cadenas de conexión, contraseñas y API keys no se copian aquí: viven solo en `.env`.

## Actividad 1 — anonimizar

### Prompt 1

I am creating a Data Privacy Vault so that PII (Personally identifiable information) becomes anonymized using node.js.

I need to start with the first step: have an endpoint so that it receives a single string with a message that contains PII like names, emails and phone numbers and returns it anonymized replacing the whole name, email and phone with an alphanumeric token.

Please act as an experienced node.js developer and tell me step by step how would you do it. Ask me for information whenever you need it and use good coding practices and comments in the functions.

An example of the request can be:

curl -X POST http://localhost:3001/anonymize -H "Content-Type: application/json" -d '{"message":"oferta de trabajo para Dago Borda con email dborda@gmail.com y teléfono 3152319157"}'

The response to that request would be:

{ "anonymizedMessage": "oferta de trabajo para d7e8e0bf bd673df2 con email b09bde30 y teléfono dd195b6c" }

### Prompt 2

Please proceed with the implementation using the following choices for our Data Privacy Vault:

- Deterministic tokens: Yes, use deterministic tokens so the same PII always generates the same token (crucial for vault lookups and mapping back).
- Reversible vault: Store token -> original PII in memory for now, using a Data Structure like Map/Object, so we can replace it with MongoDB persistence in the next step.
- Names tokenization: Follow the exact pattern shown in the sample output (e.g., replace two-word names with two individual tokens: NAME_token1 NAME_token2).
- Name detection: Use a capitalized-word regex for this first endpoint (keep it lightweight and standard for Node.js regex as per requirements).
- Phone format: Support standard 10-digit Colombian phone numbers (and optional standard formats matching the prompt example).
- PII Scope: Strictly focus on Name, Email, and Phone for this endpoint.
- False positives: Keep it simple using standard Regex detection for the PoC. We don't need a custom allowlist at this stage.

Please write clean, commented Node.js code using express and regex to create the /anonymize endpoint according to these rules.

## Actividad 1 — desanonimizar

### Prompt 3

Thanks. Now, let's implement the deanonymize endpoint where the calling should be like this:

curl -X POST http://localhost:3001/deanonymize -H "Content-Type: application/json" -d '{"anonymizedMessage":"oferta de trabajo para NAME_e1be92e2b3a5 con email EMAIL_8004719c6ea5 y teléfono PHONE_40e83067b9cb"}'

and should return the original message:

{"message":"oferta de trabajo para Dago Borda con email dborda@gmail.com y teléfono 3152319157"}

Please update the code to add this /deanonymize endpoint using the in-memory vault mapping.

## Actividad 2 — MongoDB Atlas

### Prompt 4

Please add persistence to our Data Privacy Vault using MongoDB and mongoose.

- Install mongoose and set up a connection to MongoDB Atlas using the connection string stored in `MONGO_URI` inside `.env`. Do not paste the URI or the password in the prompt.
- Create a Schema and Model (e.g., VaultEntry) to store pairs of [originalValue, token] along with the PII type (NAME, EMAIL, PHONE).
- Update both /anonymize and /deanonymize endpoints so they read and write tokens directly to/from MongoDB Atlas instead of the in-memory Map.
- Ensure lookups remain deterministic: if a PII already exists in the database, return its existing token.

En el informe el prompt incluía la cadena completa. En este archivo se reemplazó por la variable de entorno.

### Prompt 5

Please try again the MongoDB connection at application startup in src/index.js (or server.js) using mongoose.connect(process.env.MONGO_URI). Log Connected to MongoDB Atlas in the console when connected, or log any connection error. Then restart the server on port 3001 so that /anonymize saves directly to Atlas.

## Actividad 3 — OpenAI y /secureChatGPT

### Prompt 6

Please implement an OpenAI Communication & Secure Endpoint:

- Install the official openai SDK (npm install openai).
- Create a service/class (e.g., src/services/openaiService.js) that initializes OpenAI with process.env.OPENAI_API_KEY and exposes a method to call a chat completion (model gpt-4o-mini, overridable with OPENAI_MODEL).
- Create a new endpoint POST /secureChatGPT which:
  - Receives { "prompt": "string with PII" } in the request body.
  - Anonymizes the prompt using the existing MongoDB anonymize functions.
  - Sends only the anonymized prompt to OpenAI.
  - Receives the model response and deanonymizes it using the vault.
  - Restores only the tokens produced for this request. Tokens from other vault records stay unchanged.
  - Returns { "response": "final deanonymized response from OpenAI" } to the client.
- Add validation, error handling, and automated tests with fictional data. Do not call OpenAI or print secrets in tests.
- Generate README.md with the project description and installation steps.
- Generate PROMPTS.md with the prompts used so far.
- Add .env.example without secret values and keep .env out of git.

### Prompt 7

Please implement Activity 3 on top of the current code, without rewriting /anonymize or /deanonymize:

- Create a service with the official OpenAI SDK using `OPENAI_API_KEY`.
- Create the POST /secureChatGPT endpoint, keeping the same token format (NAME_, EMAIL_, PHONE_).
- Restore only the tokens produced for the current request.
- Add validation, error handling, and automated tests.
- Generate README.md, PROMPTS.md, and .env.example.
- Do not modify the Word report, do not publish to GitHub, and do not include credentials.

### Prompt 8

I am continuing the original Group 10 project for Workshop 2 of AI for Digital Business. I was previously working in Cursor. The assistant managed to generate changes in 9 files to implement Activity 3, but its free usage ran out.

I need you to review those changes and continue from the current state of the project, without starting from scratch.

- First, verify whether the OpenAI service, /secureChatGPT, the tests, README.md, and PROMPTS.md were implemented correctly.
- Then run the tests, fix any errors, and help me verify the real connections to MongoDB Atlas and OpenAI.
- Keep Activities 1 and 2 as my group developed them.
- Do not change the structure unnecessarily, do not publish changes to GitHub, and do not show credentials.

Please guide me step by step to run the project and get the screenshots we need to complete the Workshop 2 report.

### Prompt 9

Before configuring the .env file and running the tests, I want to fix an important detail. You mentioned that the tests delete MongoDB records and that they are configured to run against the `privacy_vault` database. That is my group's original database and I do not want to lose the existing records.

Please:

- Check that the automated tests use only a separate database named `privacy_vault_test`.
- Configure a `TEST_MONGO_URI` variable different from `MONGO_URI`.
- Guarantee that the tests can never delete records from the `privacy_vault` database, even if the variables are misconfigured.
- If `TEST_MONGO_URI` is missing or does not point exactly to `privacy_vault_test`, the tests must stop without modifying any data.
- Keep the OpenAI tests mocked, with no real calls.
- Keep all the code and documentation that already work.

Do not run any tests that delete records yet. First make the fixes and explain what you changed.

### Prompt 10

Yes, go ahead. I authorize you to run npm test.

Before starting, verify again that the tests use only `privacy_vault_test` and that there is no delete operation on `privacy_vault`.

Please:

- Run the automated tests and confirm how many pass.
- Verify that the 6 original records in `privacy_vault` remain intact.
- If everything works, start the server and test the /anonymize, /deanonymize, and /secureChatGPT endpoints with fictional data.
- Help me get the screenshots of the tests, especially the OpenAI response with the restored data.
- When finished, prepare a technical summary of the results to include in our Workshop 2 report.

Do not delete information from the original database, do not publish changes to GitHub, and do not show credentials. If any test fails, explain the error to me before making further changes.


