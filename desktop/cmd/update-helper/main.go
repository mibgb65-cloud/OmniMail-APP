package main

import (
	"flag"
	"omnimail/desktop/internal/updater"
	"os"
)

func main() {
	root := flag.String("root", "", "")
	current := flag.String("current", "", "")
	parent := flag.Int("parent", 0, "")
	flag.Parse()
	if updater.RunInstaller(*root, *current, *parent) != nil {
		os.Exit(1)
	}
}
