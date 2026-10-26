// meldet sich bereit und wird dann hart beendet, wie vom OOM-Killer des Kernels
process.stdout.write('{"ready":true}\n', () => process.kill(process.pid, "SIGKILL"))
