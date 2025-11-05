from fastapi.openapi.utils import get_openapi


def custom_openapi(app):
    """
    Custom OpenAPI schema generator that ensures ValidationError and
    HTTPValidationError schemas exist so tools like openapi-typescript can
    resolve $ref references.
    """
    if getattr(app, "openapi_schema", None):
        return app.openapi_schema

    openapi_schema = get_openapi(
        title="TextbookAI API",
        version="1.0.0",
        description="API for TextbookAI",
        routes=app.routes,
    )

    # Ensure components.schemas exists
    components = openapi_schema.setdefault("components", {})
    schemas = components.setdefault("schemas", {})

    # Ensure a concrete ValidationError schema exists so $ref can be resolved
    schemas.setdefault("ValidationError", {
        "title": "ValidationError",
        "required": ["loc", "msg", "type"],
        "type": "object",
        "properties": {
            "loc": {
                "title": "Location",
                "type": "array",
                "items": {"type": "string"},
            },
            "msg": {"title": "Message", "type": "string"},
            "type": {"title": "Error Type", "type": "string"},
        },
    })

    # Ensure HTTPValidationError references ValidationError
    schemas.setdefault("HTTPValidationError", {
        "title": "HTTPValidationError",
        "type": "object",
        "properties": {
            "detail": {
                "title": "Detail",
                "type": "array",
                "items": {"$ref": "#/components/schemas/ValidationError"},
            }
        },
    })

    # Replace 422 responses to reference the HTTPValidationError schema
    if "paths" in openapi_schema:
        for path_item in openapi_schema["paths"].values():
            for operation in path_item.values():
                if isinstance(operation, dict) and "responses" in operation:
                    if "422" in operation["responses"]:
                        operation["responses"]["422"] = {
                            "description": "Validation Error",
                            "content": {
                                "application/json": {
                                    "schema": {"$ref": "#/components/schemas/HTTPValidationError"}
                                }
                            },
                        }

    app.openapi_schema = openapi_schema
    return app.openapi_schema
