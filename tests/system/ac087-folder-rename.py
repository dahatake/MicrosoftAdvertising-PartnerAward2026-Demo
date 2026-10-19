"""FR-022 AC-087 — integration: rename the actual working directory, not a clone.

Execution is deliberately opt-in: ST_AC087_WORKDIR must identify the actual
pre-rename checkout. Stop servers/editors/watchers and concurrent Git writers;
obtain local rename approval before execution. This test is NOT run at design time.

Steps:
1. Reject missing/non-root/symlink input, an already-renamed source, or an
   occupied destination (no overwrite, clone, export, or content migration).
2. Record HEAD, refs, index, status (including untracked), Git common-directory
   filesystem identity, and SHA-256 of every working file, including ignored
   files; record symlink targets without following them. Exclude .git metadata
   from working-content hashes because linked-worktree path repair changes it.
3. Rename the real checkout in its existing parent to the exact AC-087 name.
   Use git worktree move for a linked worktree, os.rename for a main checkout.
4. Require the old path to be absent, exact new basename, same directory and Git
   common-directory identities, and equality of all recorded content/Git state.
   Any failed Git operation, unsafe input, or mismatch exits nonzero, never PASS.

The successful rename is retained. On failure after movement inspect the reported
paths; do not automatically overwrite/restore content. Windows open-directory
locks may prevent movement: close owners and rerun from a shell outside the
source. An already-renamed checkout cannot establish before/after evidence.
No GitHub rename, network access, push, deployment, or FR-023/AC-088 assertions.
"""

import hashlib
import json
import os
from pathlib import Path
import subprocess


def git(root, *args):
    return subprocess.check_output(
        ["git", "-C", str(root), *args], stderr=subprocess.PIPE
    ).strip()


def identity(path):
    stat = path.stat()
    assert stat.st_ino != 0, "Filesystem identity unavailable; cannot prove identity"
    return stat.st_dev, stat.st_ino


def snapshot(root):
    common = Path(os.fsdecode(git(root, "rev-parse", "--git-common-dir")))
    if not common.is_absolute():
        common = root / common
    files = {}
    for directory, folders, names in os.walk(root, followlinks=False):
        base = Path(directory)
        if base == root:
            folders[:] = [name for name in folders if name != ".git"]
            names = [name for name in names if name != ".git"]
        for name in sorted(folders + names):
            path = base / name
            relative = path.relative_to(root).as_posix()
            if path.is_symlink():
                files[relative] = ["symlink", os.readlink(path)]
            elif path.is_file():
                with path.open("rb") as stream:
                    files[relative] = ["file", hashlib.file_digest(stream, "sha256").hexdigest()]
            else:
                files[relative] = ["directory"]
    return {
        "directory_identity": identity(root),
        "git_identity": identity(common.resolve()),
        "head": git(root, "rev-parse", "HEAD").hex(),
        "refs": git(root, "for-each-ref", "--format=%(refname) %(objectname)").hex(),
        "index": git(root, "ls-files", "--stage", "-z").hex(),
        "status": git(root, "status", "--porcelain=v1", "-z", "--untracked-files=all").hex(),
        "files": files,
    }


def main():
    # FR-022 AC-087: expectations come only from the acceptance criterion.
    value = os.environ.get("ST_AC087_WORKDIR")
    assert value, "Set ST_AC087_WORKDIR to the actual pre-rename working checkout"
    supplied = Path(value).absolute()
    assert not supplied.is_symlink(), "Symlink is not the working-directory rename"
    source = supplied.resolve(strict=True)
    target = source.parent / "MicrosoftAdvertising-PartnerAward2026-Demo"
    assert source != target, "Before-rename evidence is required; already renamed"
    assert not os.path.lexists(target), "Destination occupied; must not overwrite"
    top = Path(os.fsdecode(git(source, "rev-parse", "--show-toplevel"))).resolve()
    assert top == source, "Input must be the working repository root"
    before = snapshot(source)
    print(json.dumps({"phase": "before", "source": str(source), "target": str(target),
                      "snapshot": before}, ensure_ascii=True), flush=True)
    os.chdir(source.parent)
    if (source / ".git").is_file():
        common = Path(os.fsdecode(git(source, "rev-parse", "--git-common-dir")))
        if not common.is_absolute():
            common = source / common
        git(common.resolve(), "worktree", "move", str(source), str(target))
    else:
        os.rename(source, target)
    assert not os.path.lexists(source), "Old working path still exists"
    assert target.name == "MicrosoftAdvertising-PartnerAward2026-Demo"
    after = snapshot(target)
    print(json.dumps({"phase": "after", "target": str(target), "snapshot": after},
                     ensure_ascii=True), flush=True)
    assert before == after, "Repository identity or content changed across rename"
    print("PASS FR-022 AC-087: actual folder renamed; repository/content unchanged")


if __name__ == "__main__":
    main()
