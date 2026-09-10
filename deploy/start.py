"""
Fabled Lands Sheet - Local Development Server
Start the PHP built-in server and open the browser.
Usage: python start.py
"""
import os
import sys
import subprocess
import webbrowser
import time
import signal

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PHP_BIN = r"D:\VS Code\servers\php\php.exe"
HOST = "127.0.0.1"
PORT = 8000
URL = f"http://{HOST}:{PORT}"

def main():
    if not os.path.isfile(PHP_BIN):
        print(f"ERROR: PHP not found at {PHP_BIN}")
        sys.exit(1)

    print(f"Starting PHP server on {URL}")
    print(f"Document root: {PROJECT_ROOT}")
    print("Press Ctrl+C to stop.\n")

    proc = subprocess.Popen(
        [PHP_BIN, "-S", f"{HOST}:{PORT}", "-t", PROJECT_ROOT],
        cwd=PROJECT_ROOT,
    )

    time.sleep(1)
    webbrowser.open(URL)

    def shutdown(sig, frame):
        print("\nStopping server...")
        proc.terminate()
        proc.wait()
        sys.exit(0)

    signal.signal(signal.SIGINT, shutdown)
    signal.signal(signal.SIGTERM, shutdown)

    proc.wait()

if __name__ == "__main__":
    main()
