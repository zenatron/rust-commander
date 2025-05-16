# Build both binaries
build:
	cargo build

build-windows:
	rustup target add x86_64-pc-windows-msvc && \
	cargo build --target x86_64-pc-windows-msvc --release

# Run the web server
run-server:
	cargo run --bin rust_websockets

# Clean target
clean:
	cargo clean

# Rebuild static files if needed (not necessary unless you do preprocessing)
copy-static:
	@echo "Static files assumed to be in ./static/ and served as-is."

# Full reset and rebuild
rebuild: clean build
