"""Wrapper for evaluation script."""
import sys
from pathlib import Path

fixtures_eval = Path(__file__).resolve().parent.parent / "fixtures" / "eval_citations.py"
sys.path.insert(0, str(fixtures_eval.parent))
from eval_citations import run_evaluation, print_report

if __name__ == "__main__":
    results = run_evaluation()
    print_report(results)
