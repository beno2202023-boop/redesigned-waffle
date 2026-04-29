# Aquians v1: What to do next

1. **Integrate the schema in your app layer**
   - Use `schema/aquians_article_response_v1.schema.json` as the single source of truth for output validation.
2. **Use the examples as few-shot seeds**
   - Start from `examples/aquians_article_response_v1.examples.json` and select 1–2 examples per request domain.
3. **Gate model responses in CI/CD**
   - Run `./scripts_validate_aquians_examples.py` in CI to prevent malformed training fixtures.
4. **Decide strictness policy**
   - // TODO: HUMAN Decide whether production should reject responses with missing optional `uncertainty` for high-risk domains.
   - Expected outcome: clear acceptance criteria by domain (e.g., finance/policy stricter than casual Q&A).
5. **Plan v1.1 extensions**
   - Add optional `citations` and `confidence` fields once downstream consumers are ready.
