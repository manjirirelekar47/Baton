"""Module auto-discovery. FROZEN after Day 0. Adding a module never touches a shared file."""
import importlib
import pkgutil
from pathlib import Path

import app.modules as modules_pkg


def module_names() -> list[str]:
    return sorted(m.name for m in pkgutil.iter_modules([str(Path(modules_pkg.__file__).parent)]) if m.ispkg)


def load_routers() -> list:
    routers = []
    for name in module_names():
        try:
            mod = importlib.import_module(f"app.modules.{name}.router")
        except ModuleNotFoundError as err:
            if err.name == f"app.modules.{name}.router":
                continue  # reserved module with no router yet (capture, ask, drift)
            raise
        router = getattr(mod, "router", None)
        if router is not None:
            routers.append(router)
    return routers


def reset_hooks() -> list:
    """Each module may expose reset_demo(session) in public.py. Core never touches another module's tables."""
    hooks = []
    for name in module_names():
        try:
            mod = importlib.import_module(f"app.modules.{name}.public")
        except ModuleNotFoundError as err:
            if err.name == f"app.modules.{name}.public":
                continue
            raise
        hook = getattr(mod, "reset_demo", None)
        if callable(hook):
            hooks.append(hook)
    return hooks
