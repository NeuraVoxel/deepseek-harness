.PHONY: check check-schemas check-notes test install

install:
	python3 -m pip install --user 'jsonschema>=4.22' 'pytest>=8.0'

check-schemas:
	python3 scripts/verify_schemas.py

check-notes:
	python3 scripts/verify_agent_notes.py

test:
	PYTHONPATH=pipelines python3 -m pytest -q

check: check-schemas check-notes test
