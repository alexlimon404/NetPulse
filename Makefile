UUID    = netpulse@alexlimon404.github.com
DESTDIR = $(HOME)/.local/share/gnome-shell/extensions/$(UUID)

.PHONY: all schemas install uninstall zip clean

all: schemas

schemas:
	glib-compile-schemas schemas/

install: schemas
	mkdir -p $(DESTDIR)
	cp -r extension.js prefs.js net_speed.js net_speed_status_icon.js \
	      net_speed_layout_menu_item.js lib.js metadata.json stylesheet.css \
	      schemas/ $(DESTDIR)/
	@echo "Installed to $(DESTDIR)"
	@echo "Run: gnome-extensions enable $(UUID)"

uninstall:
	rm -rf $(DESTDIR)
	@echo "Uninstalled $(UUID)"

# Creates a zip ready for upload to extensions.gnome.org
zip: schemas
	rm -f $(UUID).zip
	zip -r $(UUID).zip \
	    extension.js prefs.js net_speed.js net_speed_status_icon.js \
	    net_speed_layout_menu_item.js lib.js metadata.json stylesheet.css \
	    schemas/
	@echo "Created $(UUID).zip — ready to upload to extensions.gnome.org"

clean:
	rm -f schemas/gschemas.compiled $(UUID).zip
