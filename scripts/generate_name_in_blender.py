import bpy
import math
import os

# ==============================================================================
# CONFIGURATION
# Modify this string to change the name displayed in the landing area.
# ==============================================================================
NAME_TO_GENERATE = "MOJTABA ALEHOSSEINI"

# Positioning and layout parameters (derived from original mesh analysis)
START_POSITION = (0.448, -0.447, -2.528)  # Blender Z-Up Coordinates (X, Y, Z)
ROTATION_ANGLE_DEG = 25.0                 # Text baseline rotation (degrees around Z-axis)
FONT_SIZE = 1.6                           # Height of the letters
EXTRUDE_DEPTH = 0.23                      # Half-depth of extrusion (total depth = 0.46)
BEVEL_DEPTH = 0.02                        # Bevel depth for smooth letter edges
BEVEL_RESOLUTION = 4                      # Resolution of the bevel curve
SPACE_SPACING = 1.6                       # Spacing for space characters

# Font settings
FONT_RELATIVE_PATH = "../static/fonts/Pally-Bold.ttf"

def main():
    # 1. Ensure we are in Object Mode
    if bpy.ops.object.mode_set.poll():
        bpy.ops.object.mode_set(mode='OBJECT')

    # 2. Find or create the 'landing' collection
    collection_name = "landing"
    collection = bpy.data.collections.get(collection_name)
    if not collection:
        collection = bpy.data.collections.new(collection_name)
        bpy.context.scene.collection.children.link(collection)
        print(f"Created new collection: '{collection_name}'")

    # 3. Remove existing letters and their children (colliders)
    objects_to_delete = []
    for obj in collection.objects:
        if obj.name.startswith("refLetters"):
            objects_to_delete.append(obj)

    print(f"Deleting {len(objects_to_delete)} existing letter objects...")
    for obj in objects_to_delete:
        # Delete children first (colliders)
        for child in list(obj.children):
            bpy.data.objects.remove(child, do_unlink=True)
        bpy.data.objects.remove(obj, do_unlink=True)

    # 4. Resolve absolute path to the font
    font = None
    if bpy.data.filepath:
        blend_dir = os.path.dirname(bpy.data.filepath)
        font_path = os.path.abspath(os.path.join(blend_dir, FONT_RELATIVE_PATH))
        if os.path.exists(font_path):
            try:
                font = bpy.data.fonts.load(font_path)
                print(f"Loaded font successfully from: {font_path}")
            except Exception as e:
                print(f"Failed to load font from path: {e}")
        else:
            print(f"Font not found at: {font_path}. Using Blender's default font.")
    else:
        print("Blend file must be saved to resolve relative font path. Using Blender's default font.")

    # 5. Find the 'palette' material
    palette_mat = bpy.data.materials.get("palette")
    if not palette_mat:
        print("Warning: 'palette' material not found in current blend file. Letters will be created without material.")

    # 6. Generate the letters along the baseline
    angle_rad = math.radians(ROTATION_ANGLE_DEG)
    # Direction vector pointing along the baseline (negative X, negative Y in Blender Z-up)
    dx = -math.cos(angle_rad)
    dy = -math.sin(angle_rad)

    # Convert start position to a mutable list
    current_pos = list(START_POSITION)
    idx = 10  # Start index at .010 to match original convention

    for char in NAME_TO_GENERATE:
        if char == ' ':
            # Advance position for space character
            current_pos[0] += dx * SPACE_SPACING
            current_pos[1] += dy * SPACE_SPACING
            continue

        # Add a text object
        bpy.ops.object.text_add(location=(0, 0, 0))
        text_obj = bpy.context.active_object
        text_data = text_obj.data
        
        # Configure text content and font
        text_data.body = char
        if font:
            text_data.font = font
            
        # Configure 3D text settings (extrusion and bevel)
        text_data.extrude = EXTRUDE_DEPTH
        text_data.bevel_depth = BEVEL_DEPTH
        text_data.bevel_resolution = BEVEL_RESOLUTION
        text_data.size = FONT_SIZE
        
        # Center the text bounds (critical for correct center of mass origin!)
        text_data.align_x = 'CENTER'
        text_data.align_y = 'CENTER'

        # Convert the curve-based text object to a mesh
        bpy.ops.object.convert(target='MESH')
        mesh_obj = bpy.context.active_object

        # Move the object's origin to the geometric center of its bounds
        bpy.ops.object.origin_set(type='ORIGIN_GEOMETRY', center='BOUNDS')

        # Position and rotate the mesh object
        mesh_obj.location = tuple(current_pos)
        mesh_obj.rotation_euler = (0, 0, angle_rad)

        # Assign the 'palette' material
        if palette_mat:
            mesh_obj.data.materials.append(palette_mat)

        # Set the name of the main physics/reference mesh
        mesh_obj.name = f"refLettersPhysicalDynamic.{idx:03d}"

        # Ensure object is linked to the 'landing' collection
        if mesh_obj.name not in collection.objects:
            collection.objects.link(mesh_obj)
            # Unlink from active collection if it is not 'landing'
            if bpy.context.scene.collection != collection:
                bpy.context.scene.collection.objects.unlink(mesh_obj)

        # Create the cuboid collider child matching local bounding box dimensions
        local_bbox = mesh_obj.bound_box
        min_x = min(p[0] for p in local_bbox)
        max_x = max(p[0] for p in local_bbox)
        min_y = min(p[1] for p in local_bbox)
        max_y = max(p[1] for p in local_bbox)
        min_z = min(p[2] for p in local_bbox)
        max_z = max(p[2] for p in local_bbox)

        width = max_x - min_x
        depth = max_y - min_y
        height = max_z - min_z

        # Spawn a unit cube
        bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 0, 0))
        cube_obj = bpy.context.active_object
        cube_obj.name = f"cuboid.{idx:03d}"
        
        # Scale to match the letter's dimensions
        cube_obj.scale = (width, depth, height)

        # Parent to the letter mesh
        cube_obj.parent = mesh_obj
        # Ensure it has zero parent-inverse offset so it is centered on the mesh origin
        import mathutils
        cube_obj.matrix_parent_inverse = mathutils.Matrix.Identity(4)
        cube_obj.location = (0, 0, 0)
        cube_obj.rotation_euler = (0, 0, 0)

        # Link the collider cube to the 'landing' collection
        if cube_obj.name not in collection.objects:
            collection.objects.link(cube_obj)
            if bpy.context.scene.collection != collection:
                bpy.context.scene.collection.objects.unlink(cube_obj)

        # Calculate spacing for the next letter based on the current letter's width
        # This keeps the layout tight and professional regardless of character widths
        char_spacing = width * 0.5 + 0.65
        current_pos[0] += dx * char_spacing
        current_pos[1] += dy * char_spacing

        idx += 1

    print("Successfully generated personalized landing area letters!")

if __name__ == "__main__":
    main()
