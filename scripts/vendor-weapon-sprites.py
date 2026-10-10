#!/usr/bin/env python3
"""Vendor Bennyboi_hack's CC0 weaponpack.png from its official OpenGameArt URL.

The game must ship the PNG locally: runtime hotlinking is deliberately avoided.
"""
from __future__ import annotations

import hashlib
import struct
from pathlib import Path
from urllib.request import Request, urlopen

SOURCE = "https://opengameart.org/sites/default/files/weaponpack.png"
DEST = (
    Path(__file__).resolve().parents[1]
    / "public/art/vendor/opengameart/bennyboi-hack/weaponpack.png"
)
PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"
EXPECTED_DIMENSIONS = (160, 112)


def validate_png(data: bytes) -> None:
    if not (100 <= len(data) <= 100_000):
        raise ValueError(f"Unexpected weaponpack.png length: {len(data)}")
    if data[:8] != PNG_SIGNATURE or data[12:16] != b"IHDR":
        raise ValueError("Downloaded file is not a PNG with a valid IHDR header")
    dimensions = struct.unpack(">II", data[16:24])
    if dimensions != EXPECTED_DIMENSIONS:
        raise ValueError(f"Expected {EXPECTED_DIMENSIONS}, got {dimensions}")


def main() -> None:
    if DEST.exists():
        data = DEST.read_bytes()
        validate_png(data)
        print(f"Weapon sprites already vendored: {DEST.relative_to(DEST.parents[4])}")
    else:
        request = Request(SOURCE, headers={"User-Agent": "Folklard-asset-vendor/1.0"})
        with urlopen(request, timeout=45) as response:
            data = response.read(100_001)
        validate_png(data)
        DEST.parent.mkdir(parents=True, exist_ok=True)
        DEST.write_bytes(data)
        print(f"Downloaded CC0 weapon sprites: {DEST}")
    print("SHA256:", hashlib.sha256(data).hexdigest())


if __name__ == "__main__":
    main()
