import boto3
import logging
from typing import Optional, Dict, Any, List, Tuple
from botocore.exceptions import ClientError
from botocore.config import Config
from backend.config.settings import settings

S3_BUCKET = settings.S3_BUCKET
AWS_ACCESS_KEY_ID = settings.AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY = settings.AWS_SECRET_ACCESS_KEY

S3_CLIENT_REGION = settings.S3_REGION or None
S3_SIGV4_CONFIG = Config(signature_version="s3v4")

# Prefer default credential chain (Lambda/EC2 role, env, shared config) so
# Lambda receives temporary creds with a session token and SigV4.
import os as _os
IS_LAMBDA = bool(_os.environ.get("AWS_LAMBDA_FUNCTION_NAME"))
_endpoint_url = None
if S3_CLIENT_REGION:
	_endpoint_url = f"https://s3.{S3_CLIENT_REGION}.amazonaws.com"

if AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY and not IS_LAMBDA:
	# Use static keys only outside Lambda
	s3 = boto3.client(
		"s3",
		region_name=S3_CLIENT_REGION,
		aws_access_key_id=AWS_ACCESS_KEY_ID,
		aws_secret_access_key=AWS_SECRET_ACCESS_KEY,
		endpoint_url=_endpoint_url,
		config=S3_SIGV4_CONFIG,
	)
else:
	# Default chain (role creds in Lambda), force regional endpoint and SigV4
	s3 = boto3.client(
		"s3",
		region_name=S3_CLIENT_REGION,
		endpoint_url=_endpoint_url,
		config=S3_SIGV4_CONFIG,
	)

logger = logging.getLogger(__name__)


def get_client():
	"""Return the configured boto3 S3 client."""
	return s3


def get_bucket(default: Optional[str] = None) -> str:
	"""Resolve the bucket to use, preferring an explicit value over settings."""
	bucket = default or S3_BUCKET
	if not bucket:
		raise ValueError("S3 bucket is not configured")
	return bucket


def generate_presigned_get_url(
	key: str,
	bucket: Optional[str] = None,
	expires_in_seconds: int = 3600,
	response_content_type: Optional[str] = None,
	response_content_disposition: Optional[str] = None,
) -> str:
	"""Generate a presigned GET URL for an object.

	Args:
		key: Object key inside the bucket.
		bucket: Optional bucket override. Defaults to configured bucket.
		expires_in_seconds: URL expiry in seconds.
		response_content_type: Optional content type override for response.
		response_content_disposition: Optional content disposition (e.g., 'inline; filename="file.pdf"').

	Returns:
		A presigned URL string.
	"""
	bucket_name = get_bucket(bucket)
	params: Dict[str, Any] = {"Bucket": bucket_name, "Key": key}
	if response_content_type:
		params["ResponseContentType"] = response_content_type
	if response_content_disposition:
		params["ResponseContentDisposition"] = response_content_disposition
	# Log presign context (no secrets)
	try:
		_session = boto3.session.Session()
		_creds_obj = _session.get_credentials()
		_has_session_token = False
		if _creds_obj:
			_frozen = _creds_obj.get_frozen_credentials()
			_has_session_token = bool(getattr(_frozen, "token", None))
		print(
			f"Presigning S3 GET: bucket={bucket_name} key={key} sigv={getattr(s3.meta.config, 'signature_version', None)} "
			f"endpoint={getattr(s3.meta, 'endpoint_url', None)} has_session_token={_has_session_token}"
		)
	except Exception:
		pass
	return s3.generate_presigned_url(
		ClientMethod="get_object",
		Params=params,
		ExpiresIn=expires_in_seconds,
	)


def generate_presigned_put_url(
	key: str,
	bucket: Optional[str] = None,
	expires_in_seconds: int = 3600,
	content_type: Optional[str] = None,
	acl: Optional[str] = None,
) -> str:
	"""Generate a presigned PUT URL for direct uploads.

	Note: The caller should set the same Content-Type header when using the URL if provided.
	"""
	bucket_name = get_bucket(bucket)
	params: Dict[str, Any] = {"Bucket": bucket_name, "Key": key}
	if content_type:
		params["ContentType"] = content_type
	if acl:
		params["ACL"] = acl
	return s3.generate_presigned_url(
		ClientMethod="put_object",
		Params=params,
		ExpiresIn=expires_in_seconds,
	)


def generate_presigned_post(
	key: str,
	bucket: Optional[str] = None,
	expires_in_seconds: int = 3600,
	fields: Optional[Dict[str, str]] = None,
	conditions: Optional[List[Any]] = None,
) -> Dict[str, Any]:
	"""Generate a presigned POST policy for browser uploads.

	Returns a dict with keys: url, fields. The caller should submit a multipart/form-data POST
	to 'url' including the returned 'fields' and the file content.
	"""
	bucket_name = get_bucket(bucket)
	return s3.generate_presigned_post(
		Bucket=bucket_name,
		Key=key,
		Fields=fields or {},
		Conditions=conditions or [],
		ExpiresIn=expires_in_seconds,
	)


def object_exists(key: str, bucket: Optional[str] = None) -> bool:
	"""Check whether an object exists using head_object."""
	bucket_name = get_bucket(bucket)
	try:
		s3.head_object(Bucket=bucket_name, Key=key)
		return True
	except ClientError as e:
		code = str((e.response or {}).get("Error", {}).get("Code", ""))
		if code in ("404", "NotFound", "NoSuchKey"):
			return False
		raise


def head_object(key: str, bucket: Optional[str] = None) -> Dict[str, Any]:
	"""Return object metadata (headers)."""
	bucket_name = get_bucket(bucket)
	return s3.head_object(Bucket=bucket_name, Key=key)


def upload_file(
	file_path: str,
	key: str,
	bucket: Optional[str] = None,
	extra_args: Optional[Dict[str, Any]] = None,
) -> None:
	"""Upload a local file to S3 at the given key."""
	bucket_name = get_bucket(bucket)
	s3.upload_file(Filename=file_path, Bucket=bucket_name, Key=key, ExtraArgs=extra_args or {})


def upload_bytes(
	data: bytes,
	key: str,
	bucket: Optional[str] = None,
	content_type: Optional[str] = None,
	extra_args: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
	"""Upload raw bytes to S3 using put_object."""
	bucket_name = get_bucket(bucket)
	kwargs: Dict[str, Any] = {"Bucket": bucket_name, "Key": key, "Body": data}
	if content_type:
		kwargs["ContentType"] = content_type
	if extra_args:
		kwargs.update(extra_args)
	return s3.put_object(**kwargs)


def download_file(
	key: str,
	destination_path: str,
	bucket: Optional[str] = None,
) -> None:
	"""Download an S3 object to a local path."""
	bucket_name = get_bucket(bucket)
	s3.download_file(Bucket=bucket_name, Key=key, Filename=destination_path)


def get_object_bytes(key: str, bucket: Optional[str] = None) -> bytes:
	"""Fetch an object's bytes content."""
	bucket_name = get_bucket(bucket)
	resp = s3.get_object(Bucket=bucket_name, Key=key)
	return resp["Body"].read()


def delete_object(key: str, bucket: Optional[str] = None) -> Dict[str, Any]:
	"""Delete a single object."""
	bucket_name = get_bucket(bucket)
	return s3.delete_object(Bucket=bucket_name, Key=key)


def delete_prefix(prefix: str, bucket: Optional[str] = None) -> Tuple[int, List[str]]:
	"""Delete up to 1000 objects under a prefix in a single request.

	Returns a tuple (#deleted, deleted_keys).
	"""
	bucket_name = get_bucket(bucket)
	listed = list_objects(prefix=prefix, bucket=bucket_name, max_keys=1000)
	keys = [item["key"] for item in listed["items"]]
	if not keys:
		return 0, []
	objects = [{"Key": k} for k in keys]
	resp = s3.delete_objects(Bucket=bucket_name, Delete={"Objects": objects, "Quiet": True})
	deleted = resp.get("Deleted", [])
	return len(deleted), [d.get("Key", "") for d in deleted]


def copy_object(
	source_key: str,
	destination_key: str,
	source_bucket: Optional[str] = None,
	destination_bucket: Optional[str] = None,
	extra_args: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
	"""Copy an object within/between buckets."""
	src_bucket = get_bucket(source_bucket)
	dst_bucket = get_bucket(destination_bucket or source_bucket)
	source = {"Bucket": src_bucket, "Key": source_key}
	kwargs: Dict[str, Any] = {"Bucket": dst_bucket, "Key": destination_key, "CopySource": source}
	if extra_args:
		kwargs.update(extra_args)
	return s3.copy_object(**kwargs)


def update_object_metadata(
	key: str,
	metadata: Dict[str, str],
	bucket: Optional[str] = None,
	content_type: Optional[str] = None,
) -> Dict[str, Any]:
	"""Update object metadata by issuing a self-copy with MetadataDirective='REPLACE'.

	If content_type is not provided, attempts to preserve the existing ContentType.
	"""
	bucket_name = get_bucket(bucket)
	try:
		head = s3.head_object(Bucket=bucket_name, Key=key)
		existing_content_type = head.get("ContentType")
	except ClientError:
		existing_content_type = None
	kwargs: Dict[str, Any] = {
		"Bucket": bucket_name,
		"Key": key,
		"CopySource": {"Bucket": bucket_name, "Key": key},
		"Metadata": metadata,
		"MetadataDirective": "REPLACE",
	}
	ct = content_type or existing_content_type
	if ct:
		kwargs["ContentType"] = ct
	return s3.copy_object(**kwargs)


def list_objects(
	prefix: str = "",
	bucket: Optional[str] = None,
	max_keys: int = 1000,
	continuation_token: Optional[str] = None,
) -> Dict[str, Any]:
	"""List objects under a prefix. Returns { items: [...], next_token }.

	Items contain: key, size, last_modified, etag.
	"""
	bucket_name = get_bucket(bucket)
	kwargs: Dict[str, Any] = {"Bucket": bucket_name, "Prefix": prefix, "MaxKeys": max_keys}
	if continuation_token:
		kwargs["ContinuationToken"] = continuation_token
	resp = s3.list_objects_v2(**kwargs)
	contents = resp.get("Contents", []) or []
	items: List[Dict[str, Any]] = []
	for obj in contents:
		items.append({
			"key": obj.get("Key"),
			"size": obj.get("Size"),
			"last_modified": obj.get("LastModified"),
			"etag": obj.get("ETag"),
		})
	return {
		"items": items,
		"next_token": resp.get("NextContinuationToken"),
	}