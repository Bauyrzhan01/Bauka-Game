extends Node2D

@onready var player: CharacterBody2D = $Player
@onready var camera: Camera2D = $Camera2D

func _ready() -> void:
	camera.position_smoothing_enabled = true

func _process(_delta: float) -> void:
	camera.global_position = player.global_position
