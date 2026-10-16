// Package notify meldet systemd Bereitschaft und Lebenszeichen (sd_notify), ohne Bibliothek. Ohne NOTIFY_SOCKET
// (kein Dienst mit Type=notify, Windows, Tests) tut es nichts.
package notify

import (
	"net"
	"os"
)

// Ready: die Brücke läuft (READY=1); vorher gilt der Dienst als startend.
func Ready() error { return send("READY=1") }

// Alive: die Schleife lebt (WATCHDOG=1); bleibt die Meldung länger als WatchdogSec aus, beendet systemd die Brücke.
func Alive() error { return send("WATCHDOG=1") }

func send(state string) error {
	name := os.Getenv("NOTIFY_SOCKET")
	if name == "" {
		return nil
	}
	// abstrakter Socket unter Linux: „@“ steht für das Nullbyte
	if name[0] == '@' {
		name = "\x00" + name[1:]
	}
	conn, err := net.DialUnix("unixgram", nil, &net.UnixAddr{Name: name, Net: "unixgram"})
	if err != nil {
		return err
	}
	defer conn.Close()
	_, err = conn.Write([]byte(state))
	return err
}
