import warnings
from io import BytesIO
from uuid import uuid4
from PIL import Image, ImageOps, UnidentifiedImageError
from django.core.files.base import ContentFile
from rest_framework.exceptions import ValidationError


def clean_cover(upload):
    if upload is None:
        return None
    if upload.size > 5 * 1024 * 1024:
        raise ValidationError('Choose a JPEG, PNG, or WebP under 5 MB.')
    try:
        with warnings.catch_warnings():
            warnings.simplefilter('error', Image.DecompressionBombWarning)
            with Image.open(upload) as original:
                if original.format not in ['JPEG', 'PNG', 'WEBP'] or original.width * original.height > 25_000_000:
                    raise ValueError()
                original.load()
                normalized = ImageOps.exif_transpose(original)
                normalized.thumbnail((1600, 1000))
                rgba = normalized.convert('RGBA')
                clean = Image.new('RGB', rgba.size, 'white')
                clean.paste(rgba, mask=rgba.getchannel('A'))
                output = BytesIO()
                clean.save(output, format='JPEG', quality=88)
    except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError, Image.DecompressionBombWarning):
        raise ValidationError('Use a readable JPEG, PNG, or WebP up to 25 megapixels.')
    return ContentFile(output.getvalue(), name=f'{uuid4().hex}.jpg')
