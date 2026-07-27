UUID    = netpulse@alexlimon404.github.com
DESTDIR = $(HOME)/.local/share/gnome-shell/extensions/$(UUID)

.PHONY: all schemas install uninstall zip clean

all: schemas

schemas:
	glib-compile-schemas schemas/

install: schemas
	mkdir -p $(DESTDIR)
	cp -r extension.js prefs.js net_speed.js net_speed_status_icon.js \
	      net_speed_layout_menu_item.js metadata.json stylesheet.css \
	      schemas/ $(DESTDIR)/
	@echo "Installed to $(DESTDIR)"
	@echo "Run: gnome-extensions enable $(UUID)"

uninstall:
	rm -rf $(DESTDIR)
	@echo "Uninstalled $(UUID)"

# Creates a zip ready for upload to extensions.gnome.org.
# gschemas.compiled is deliberately left out — EGO compiles the schema itself
# and rejects packages that ship build artifacts.
zip:
	rm -f $(UUID).zip
	zip -r $(UUID).zip \
	    extension.js prefs.js net_speed.js net_speed_status_icon.js \
	    net_speed_layout_menu_item.js metadata.json stylesheet.css \
	    schemas/ -x 'schemas/gschemas.compiled'
	@echo "Created $(UUID).zip — ready to upload to extensions.gnome.org"

clean:
	rm -f schemas/gschemas.compiled $(UUID).zip
