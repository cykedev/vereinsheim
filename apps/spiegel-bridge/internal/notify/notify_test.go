package notify

import (
	"fmt"
	"net"
	"os"
	"path/filepath"
	"runtime"
	"testing"
	"time"
)

// listen öffnet einen Socket wie systemd und gibt zurück, was ankommt.
func listen(t *testing.T, name string) func() string {
	t.Helper()
	conn, err := net.ListenUnixgram("unixgram", &net.UnixAddr{Name: name, Net: "unixgram"})
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { conn.Close() })
	return func() string {
		t.Helper()
		buf := make([]byte, 64)
		_ = conn.SetReadDeadline(time.Now().Add(2 * time.Second))
		n, err := conn.Read(buf)
		if err != nil {
			t.Fatal(err)
		}
		return string(buf[:n])
	}
}

// socketPath: kurz, macOS nimmt höchstens 104 Byte
func socketPath(t *testing.T) string {
	t.Helper()
	dir, err := os.MkdirTemp("", "n")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { os.RemoveAll(dir) })
	return filepath.Join(dir, "s")
}

func TestWithoutSocketNothing(t *testing.T) {
	t.Setenv("NOTIFY_SOCKET", "")
	if err := Ready(); err != nil {
		t.Fatal(err)
	}
	if err := Alive(); err != nil {
		t.Fatal(err)
	}
}

func TestSendsDatagram(t *testing.T) {
	path := socketPath(t)
	read := listen(t, path)
	t.Setenv("NOTIFY_SOCKET", path)
	if err := Ready(); err != nil {
		t.Fatal(err)
	}
	if got := read(); got != "READY=1" {
		t.Fatalf("%q", got)
	}
	if err := Alive(); err != nil {
		t.Fatal(err)
	}
	if got := read(); got != "WATCHDOG=1" {
		t.Fatalf("%q", got)
	}
}

func TestAbstractSocket(t *testing.T) {
	if runtime.GOOS != "linux" {
		t.Skip("abstrakte Sockets gibt es nur unter Linux")
	}
	name := fmt.Sprintf("spiegel-bridge-test-%d", os.Getpid())
	read := listen(t, "\x00"+name)
	t.Setenv("NOTIFY_SOCKET", "@"+name)
	if err := Alive(); err != nil {
		t.Fatal(err)
	}
	if got := read(); got != "WATCHDOG=1" {
		t.Fatalf("%q", got)
	}
}

func TestUnreachableSocketFails(t *testing.T) {
	t.Setenv("NOTIFY_SOCKET", socketPath(t))
	if err := Alive(); err == nil {
		t.Fatal("ohne Socket kein Fehler")
	}
}
