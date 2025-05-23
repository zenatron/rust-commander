use std::fs::{self, File};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use serde_json;
use directories::ProjectDirs;

use crate::types::{Palette};

const PALETTE_DIR_NAME: &str = "palettes";

// Helper function to get the application's data directory for palettes
fn get_palette_storage_dir() -> Result<PathBuf, String> {
    if let Some(proj_dirs) = ProjectDirs::from("com", "RustCommander", "RustCommander") {
        let data_dir = proj_dirs.data_dir();
        let palette_dir = data_dir.join(PALETTE_DIR_NAME);
        if !palette_dir.exists() {
            fs::create_dir_all(&palette_dir)
                .map_err(|e| format!("Failed to create palette directory: {}", e))?;
        }
        Ok(palette_dir)
    } else {
        Err("Unable to find project directories".to_string())
    }
}

// Lists all available palettes
pub fn list_palettes() -> Result<Vec<String>, String> {
    let dir = get_palette_storage_dir()?;
    let mut palettes = Vec::new();
    for entry in fs::read_dir(dir).map_err(|e| format!("Failed to read palette directory: {}", e))? {
        let entry = entry.map_err(|e| format!("Failed to read directory entry: {}", e))?;
        let path = entry.path();
        if path.is_file() && path.extension().map_or(false, |ext| ext == "json") {
            if let Some(stem) = path.file_stem().and_then(|s| s.to_str()) {
                palettes.push(stem.to_string());
            }
        }
    }
    Ok(palettes)
}

// Loads a specific palette by name
pub fn load_palette(name: &str) -> Result<Palette, String> {
    let dir = get_palette_storage_dir()?;
    let file_path = dir.join(format!("{}.json", name));
    if !file_path.exists() {
        return Err(format!("Palette '{}' not found.", name));
    }
    let mut file = File::open(&file_path).map_err(|e| format!("Failed to open palette file: {}", e))?;
    let mut contents = String::new();
    file.read_to_string(&mut contents).map_err(|e| format!("Failed to read palette file: {}", e))?;
    serde_json::from_str(&contents).map_err(|e| format!("Failed to parse palette JSON: {}", e))
}

// Saves a palette
pub fn save_palette(palette: &Palette) -> Result<(), String> {
    let dir = get_palette_storage_dir()?;
    let file_path = dir.join(format!("{}.json", palette.name));
    let mut file = File::create(&file_path).map_err(|e| format!("Failed to create palette file: {}", e))?;
    let contents = serde_json::to_string_pretty(palette).map_err(|e| format!("Failed to serialize palette: {}", e))?;
    file.write_all(contents.as_bytes()).map_err(|e| format!("Failed to write palette file: {}", e))
}

// Deletes a palette by name
pub fn delete_palette(name: &str) -> Result<(), String> {
    let dir = get_palette_storage_dir()?;
    let file_path = dir.join(format!("{}.json", name));
    if !file_path.exists() {
        return Err(format!("Palette '{}' not found for deletion.", name));
    }
    fs::remove_file(&file_path).map_err(|e| format!("Failed to delete palette file: {}", e))
}

// Imports a palette from a temporary file path (e.g., after an upload)
// The new_palette_name is the name to save it under, extracted from the Palette struct itself
pub fn import_palette(temp_file_path: &Path) -> Result<Palette, String> {
    let mut file = File::open(temp_file_path).map_err(|e| format!("Failed to open temporary palette file: {}", e))?;
    let mut contents = String::new();
    file.read_to_string(&mut contents).map_err(|e| format!("Failed to read temporary palette file: {}", e))?;
    
    let palette: Palette = serde_json::from_str(&contents).map_err(|e| format!("Failed to parse uploaded palette JSON: {}", e))?;
    
    // Now save it using the existing save_palette function
    save_palette(&palette)?; // This will use palette.name
    Ok(palette)
} 