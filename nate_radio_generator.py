#!/usr/bin/env python3
"""Offline pre-render helper for Nate radio lines via ElevenLabs.

This script intentionally does no runtime generation in the game loop.
It writes compressed audio files ahead of time to keep engine overhead tiny.
"""

from __future__ import annotations

import argparse
import json
import os
import pathlib
import sys
import time
import urllib.error
import urllib.request

DEFAULT_LINES = [
    "The drywall isn't a barrier. It's the equator...",
    "You're two hands on the same cosmic steering wheel.",
    "The physical form doesn't matter, it's the intention behind the swing.",
    "Pick up your fork, buddy. We got work to do.",
]


def parse_args() -> argparse.Namespace:
  parser = argparse.ArgumentParser(description='Generate Nate radio voice lines')
  parser.add_argument('--voice-id', required=True, help='ElevenLabs voice id')
  parser.add_argument('--output-dir', default='audio/nate', help='Output directory')
  parser.add_argument('--model-id', default='eleven_multilingual_v2', help='Model id')
  parser.add_argument('--lines-file', help='Optional JSON file containing a list of lines')
  parser.add_argument('--dry-run', action='store_true', help='Print requests without calling API')
  return parser.parse_args()


def load_lines(lines_file: str | None) -> list[str]:
  if not lines_file:
    return DEFAULT_LINES

  with open(lines_file, 'r', encoding='utf-8') as handle:
    data = json.load(handle)

  if not isinstance(data, list) or not all(isinstance(item, str) for item in data):
    raise ValueError('lines-file must be a JSON string array')

  return data


def synthesize_line(api_key: str, voice_id: str, model_id: str, text: str) -> bytes:
  url = f'https://api.elevenlabs.io/v1/text-to-speech/{voice_id}'
  payload = json.dumps(
      {
          'text': text,
          'model_id': model_id,
          'voice_settings': {'stability': 0.3, 'similarity_boost': 0.7},
      }
  ).encode('utf-8')

  request = urllib.request.Request(
      url,
      data=payload,
      method='POST',
      headers={
          'Accept': 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': api_key,
      },
  )

  with urllib.request.urlopen(request, timeout=60) as response:
    return response.read()


def main() -> int:
  args = parse_args()
  lines = load_lines(args.lines_file)

  api_key = os.environ.get('ELEVENLABS_API_KEY')
  if not api_key and not args.dry_run:
    print('Missing ELEVENLABS_API_KEY.', file=sys.stderr)
    return 2

  out_dir = pathlib.Path(args.output_dir)
  out_dir.mkdir(parents=True, exist_ok=True)

  for index, line in enumerate(lines):
    name = f'nate_{index:02d}.mp3'
    output_file = out_dir / name

    if args.dry_run:
      print(f'[dry-run] {name}: {line}')
      continue

    try:
      audio_data = synthesize_line(api_key, args.voice_id, args.model_id, line)
    except (urllib.error.URLError, TimeoutError) as exc:
      print(f'Failed line {index}: {exc}', file=sys.stderr)
      return 1

    output_file.write_bytes(audio_data)
    print(f'Wrote {output_file} ({len(audio_data)} bytes)')
    time.sleep(0.2)

  return 0


if __name__ == '__main__':
  raise SystemExit(main())
