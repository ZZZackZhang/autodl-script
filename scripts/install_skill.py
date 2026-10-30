#!/usr/bin/env python3
"""Install only the skill resources; preserve an existing installation by default."""

import argparse
import os
import shutil
import tempfile
from datetime import datetime, timezone
from pathlib import Path


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--skills-dir", type=Path, help="Override the Codex skills directory")
    parser.add_argument("--replace", action="store_true", help="Back up and replace an existing installation")
    args = parser.parse_args()
    codex_dir = Path(os.environ.get("CODEX_HOME", str(Path.home() / ".codex"))).expanduser()
    skills_dir = args.skills_dir.expanduser() if args.skills_dir else codex_dir / "skills"
    source = Path(__file__).resolve().parents[1]
    target = skills_dir / "autodl-auto-rent"
    if target.exists() and not args.replace:
        parser.exit(1, f"Already installed: {target}\nUse --replace to back up and replace it.\n")
    if target.resolve() == source:
        parser.exit(1, "The source checkout cannot also be the installation target.\n")
    resources = ("SKILL.md", "agents", "references", "assets")
    for name in resources:
        if not (source / name).exists():
            parser.exit(1, f"Missing skill resource: {name}\n")
    skills_dir.mkdir(parents=True, exist_ok=True)
    # Stage outside skills so a partially copied skill is never discovered.
    with tempfile.TemporaryDirectory(prefix="autodl-install-", dir=skills_dir.parent) as temp:
        staged = Path(temp) / target.name
        staged.mkdir()
        for name in resources:
            item = source / name
            if item.is_dir():
                shutil.copytree(item, staged / name)
            else:
                shutil.copy2(item, staged / name)
        if target.exists():
            stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
            backup_dir = skills_dir.parent / "skill-backups"
            backup_dir.mkdir(exist_ok=True)
            backup = backup_dir / f"{target.name}-{stamp}"
            target.rename(backup)
            try:
                staged.rename(target)
            except Exception:
                backup.rename(target)
                raise
            print(f"Previous version preserved: {backup}")
        else:
            staged.rename(target)
    print(f"Installed: {target}")
    print("Invoke $autodl-auto-rent with a complete preset to begin a rental task.")


if __name__ == "__main__":
    main()
