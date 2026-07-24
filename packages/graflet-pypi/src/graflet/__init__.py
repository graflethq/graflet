"""graflet — docs as a graph, not snippets.

The graflet CLI is a Node tool, published to npm as ``@graflethq/cli``. This PyPI package is a thin
launcher, not a reimplementation: when Node is available it hands off to the real CLI via ``npx``;
otherwise it prints how to install it. Dependency-free by design.
"""
import shutil
import subprocess
import sys

__version__ = "0.1.0"

NPM_PKG = "@graflethq/cli"
INSTALL_HINT = (
    "graflet's CLI ships on npm (it's a Node tool):\n"
    f"    npm i -g {NPM_PKG}      # needs Node >= 18\n"
    "then run:  graflet <library>\n"
    "Catalog & docs: https://graflet.rnui.dev"
)


def main() -> None:
    """Delegate to the real Node CLI via ``npx`` when Node is on PATH, so ``pipx install graflet``
    gives Node users a working ``graflet``. With no Node, print the install hint and exit non-zero."""
    args = sys.argv[1:]
    npx = shutil.which("npx")
    if npx:
        try:
            raise SystemExit(subprocess.call([npx, "--yes", NPM_PKG, *args]))
        except FileNotFoundError:
            pass  # npx disappeared between the lookup and the call — fall through to the hint
    print(INSTALL_HINT, file=sys.stderr)
    raise SystemExit(1)


if __name__ == "__main__":
    main()
