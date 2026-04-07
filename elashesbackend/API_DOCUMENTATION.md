# 📋 DOCUMENTACIÓN COMPLETA DE API - Sistema de Reconocimiento Facial y Análisis de Pestañas

## 🌐 Información General

**Base URL:** `http://localhost:8000`  
**Documentación Interactiva:** `http://localhost:8000/docs`  
**ReDoc:** `http://localhost:8000/redoc`

**Versión:** 1.0.0  
**Descripción:** API completa para reconocimiento facial, análisis de pestañas y procesamiento en tiempo real con soporte para aplicaciones Flutter.


---

## 📑 Índice de Endpoints

### 🏠 [Endpoints Principales](#endpoints-principales)
- [GET /](#get-) - Mensaje de bienvenida
- [GET /health](#get-health) - Health Check

### 👤 [Reconocimiento Facial](#reconocimiento-facial)
- [POST /face/detect/base64](#post-facedetectbase64) - Detectar rostros (Base64)
- [POST /face/detect/file](#post-facedetectfile) - Detectar rostros (Archivo)
- [POST /face/recognize/base64](#post-facerecognizebase64) - Reconocer rostros (Base64)
- [POST /face/recognize/file](#post-facerecognizefile) - Reconocer rostros (Archivo)
- [POST /face/live/process](#post-faceliveprocess) - Procesamiento en tiempo real

### 👥 [Gestión de Personas](#gestión-de-personas)
- [POST /face/persons/register/base64](#post-facepersonsregisterbase64) - Registrar persona (Base64)
- [POST /face/persons/register/file](#post-facepersonsregisterfile) - Registrar persona (Archivo)
- [GET /face/persons/](#get-facepersons) - Listar todas las personas
- [GET /face/persons/{person_id}](#get-facepersonsperson_id) - Obtener persona específica
- [DELETE /face/persons/{person_id}](#delete-facepersonsperson_id) - Eliminar persona

### 👁️ [Sistema de Análisis de Pestañas](#sistema-de-análisis-de-pestañas)
- [POST /face/persons/register-with-eyelashes](#post-facepersonsregister-with-eyelashes) - Registro completo con pestañas
- [POST /face/eyelashes/save](#post-faceeyelashessave) - Guardar análisis de pestañas
- [POST /face/recognize-and-analyze](#post-facerecognize-and-analyze) - Reconocimiento + análisis automático
- [GET /face/persons/{person_id}/eyelashes](#get-facepersonsperson_ideyelashes) - Historial de pestañas
- [GET /face/persons/{person_id}/eyelashes/latest](#get-facepersonsperson_ideyelasheslatest) - Último análisis
- [GET /face/persons/{person_id}/eyelashes/evolution](#get-facepersonsperson_ideyelashesevolution) - Evolución de pestañas

### 🔍 [Detección Avanzada de Pestañas](#detección-avanzada-de-pestañas)
- [POST /face/detect/eyelashes](#post-facedetecteyelashes) - Detección avanzada de pestañas
- [POST /face/analyze/eyelash-quality](#post-faceanalyzeeyelash-quality) - Análisis de calidad de pestañas
- [POST /face/detect/eyes](#post-facedetecteyes) - Detección enfocada en ojos

### 📷 [Escaneo en Tiempo Real](#escaneo-en-tiempo-real)
- [POST /face/scan/eyelashes/live](#post-facescaneyelasheslive) - Escaneo en vivo
- [POST /face/scan/eyelashes/start-session](#post-facescaneyelashesstart-session) - Iniciar sesión de escaneo
- [GET /face/scan/eyelashes/session/{session_id}](#get-facescaneyelashessessionsession_id) - Info de sesión
- [POST /face/scan/eyelashes/end-session/{session_id}](#post-facescaneyelashesend-sessionsession_id) - Finalizar sesión
- [GET /face/scan/eyelashes/sessions](#get-facescaneyelashessessions) - Sesiones activas
- [POST /face/scan/eyelashes/batch](#post-facescaneyelashesbatch) - Procesamiento en lote

### 📊 [Gestión de Registros](#gestión-de-registros)
- [GET /face/eyelashes/records/{record_id}](#get-faceeyelashesrecordsrecord_id) - Obtener registro específico
- [GET /face/eyelashes/records/{record_id}/image](#get-faceeyelashesrecordsrecord_idimage) - Imagen de registro
- [PUT /face/eyelashes/records/{record_id}/notes](#put-faceeyelashesrecordsrecord_idnotes) - Actualizar notas
- [DELETE /face/eyelashes/records/{record_id}](#delete-faceeyelashesrecordsrecord_id) - Eliminar registro
- [GET /face/eyelashes/search](#get-faceeyelashessearch) - Buscar registros

### 🧪 [Items de Prueba](#items-de-prueba)
- [POST /items/](#post-items) - Crear item
- [GET /items/](#get-items) - Listar items
- [GET /items/{item_id}](#get-itemsitem_id) - Obtener item
- [PUT /items/{item_id}](#put-itemsitem_id) - Actualizar item
- [DELETE /items/{item_id}](#delete-itemsitem_id) - Eliminar item
- [GET /items/search/query](#get-itemssearchquery) - Buscar items

---

## 🏠 Endpoints Principales

### GET /

**Descripción:** Mensaje de bienvenida de la API

**Respuesta:**
```json
{
  "message": "API de Reconocimiento Facial funcionando correctamente"
}
```

### GET /health

**Descripción:** Verificar estado de salud de la API

**Respuesta:**
```json
{
  "status": "healthy",
  "timestamp": "2025-01-01T12:00:00Z",
  "version": "1.0.0",
  "services": {
    "face_detection": "active",
    "database": "connected",
    "eyelash_analysis": "ready"
  }
}
```

---

## 👤 Reconocimiento Facial

### POST /face/detect/base64

**Descripción:** Detecta rostros en una imagen codificada en base64. Perfecto para aplicaciones Flutter.

**Parámetros:**
```json
{
  "image_base64": "string (required)",
  "image_name": "string (default: 'uploaded_image')"
}
```

**Respuesta Exitosa (200):**
```json
{
  "faces_count": 2,
  "eyes_count": 4,
  "faces": [
    {
      "x": 100,
      "y": 50,
      "width": 150,
      "height": 180
    }
  ],
  "eyes": [
    {
      "x": 120,
      "y": 80,
      "width": 30,
      "height": 25
    }
  ],
  "confidence_scores": [0.95, 0.87],
  "processing_time_ms": 245.3,
  "image_size": [1280, 720],
  "annotated_image_base64": "base64_string..."
}
```

### POST /face/detect/file

**Descripción:** Detecta rostros en un archivo de imagen subido.

**Parámetros:**
- `file`: Archivo de imagen (multipart/form-data)

**Respuesta:** Igual que `/face/detect/base64`

### POST /face/recognize/base64

**Descripción:** Reconoce rostros comparando con personas registradas en la base de datos.

**Parámetros:**
```json
{
  "image_base64": "string (required)"
}
```

**Respuesta Exitosa (200):**
```json
[
  {
    "recognized": true,
    "person_id": 123,
    "person_name": "Juan Pérez",
    "confidence": 0.92,
    "face_location": {
      "x": 100,
      "y": 50,
      "width": 150,
      "height": 180
    },
    "processing_time": 187.5
  }
]
```

### POST /face/recognize/file

**Descripción:** Reconoce rostros en archivo de imagen subido.

**Parámetros:**
- `file`: Archivo de imagen (multipart/form-data)

**Respuesta:** Igual que `/face/recognize/base64`

### POST /face/live/process

**Descripción:** Procesa un frame de cámara en tiempo real. Ideal para streams de cámara de Flutter.

**Parámetros:**
```json
{
  "image_base64": "string (required)",
  "frame_id": "string (required)"
}
```

**Respuesta Exitosa (200):**
```json
{
  "faces_detected": 1,
  "recognized_faces": [...],
  "unknown_faces": [...],
  "eyelashes_detected": 8,
  "frame_id": "frame_001",
  "timestamp": "2025-01-01T12:00:00Z"
}
```

---

## 👥 Gestión de Personas

### POST /face/persons/register/base64

**Descripción:** Registra una nueva persona con su foto en base64 para entrenar el reconocimiento facial.

**Parámetros:**
```json
{
  "name": "string (required, min: 1, max: 100)",
  "email": "string (optional)",
  "image_base64": "string (required)"
}
```

**Respuesta Exitosa (200):**
```json
{
  "id": 123,
  "name": "Ana García",
  "email": "ana@example.com",
  "photos_count": 1,
  "created_at": "2025-01-01T12:00:00Z",
  "is_active": true
}
```

### POST /face/persons/register/file

**Descripción:** Registra una nueva persona con archivo de foto.

**Parámetros (form-data):**
- `name`: string (required)
- `email`: string (optional)
- `file`: Archivo de imagen (required)

**Respuesta:** Igual que `/face/persons/register/base64`

### GET /face/persons/

**Descripción:** Obtiene lista de todas las personas registradas con paginación.

**Query Parameters:**
- `skip`: int (default: 0) - Elementos a omitir
- `limit`: int (default: 50) - Máximo elementos a retornar

**Respuesta Exitosa (200):**
```json
[
  {
    "id": 123,
    "name": "Ana García",
    "email": "ana@example.com",
    "photos_count": 3,
    "created_at": "2025-01-01T12:00:00Z",
    "is_active": true
  }
]
```

### GET /face/persons/{person_id}

**Descripción:** Obtiene información detallada de una persona específica.

**Path Parameters:**
- `person_id`: int (required) - ID de la persona

**Respuesta Exitosa (200):**
```json
{
  "id": 123,
  "name": "Ana García",
  "email": "ana@example.com",
  "photos_count": 3,
  "created_at": "2025-01-01T12:00:00Z",
  "is_active": true
}
```

### DELETE /face/persons/{person_id}

**Descripción:** Elimina una persona registrada y todos sus datos asociados.

**Path Parameters:**
- `person_id`: int (required) - ID de la persona

**Respuesta Exitosa (200):**
```json
{
  "message": "Persona eliminada exitosamente"
}
```

---

## 👁️ Sistema de Análisis de Pestañas

### POST /face/persons/register-with-eyelashes

**Descripción:** Registra una nueva persona y opcionalmente analiza sus pestañas inmediatamente. Este es el endpoint principal para registro completo.

**Parámetros:**
```json
{
  "name": "string (required)",
  "email": "string (optional)", 
  "image_base64": "string (required)",
  "analyze_eyelashes": "boolean (default: true)"
}
```

**Respuesta Exitosa (200):**
```json
{
  "success": true,
  "person_id": 123,
  "name": "María López",
  "email": "maria@example.com",
  "eyelashes_detected": 12,
  "eyelash_record_id": 456,
  "analysis": {
    "density": 0.85,
    "average_length": 8.5,
    "curvature": 0.7,
    "thickness": 0.6,
    "coverage": 92.3,
    "health_score": 87.5,
    "characteristics": ["thick", "curved", "healthy"]
  },
  "message": "Persona registrada y pestañas analizadas exitosamente"
}
```

### POST /face/eyelashes/save

**Descripción:** Guarda un análisis de pestañas para una persona registrada. Detecta y analiza las pestañas, guardando el resultado en el historial.

**Parámetros:**
```json
{
  "person_id": "int (required)",
  "image_base64": "string (required)",
  "notes": "string (optional)"
}
```

**Respuesta Exitosa (200):**
```json
{
  "success": true,
  "record_id": 789,
  "person_id": 123,
  "eyelashes_count": 14,
  "analysis": {
    "density": 0.88,
    "average_length": 9.2,
    "curvature": 0.75,
    "thickness": 0.65,
    "coverage": 94.1,
    "health_score": 89.2,
    "characteristics": ["very_thick", "well_curved", "excellent_health"]
  },
  "created_at": "2025-01-01T12:00:00Z",
  "notes": "Análisis después del tratamiento"
}
```

### POST /face/recognize-and-analyze

**Descripción:** Reconoce a una persona en la imagen y analiza automáticamente sus pestañas. Si la persona es reconocida, guarda el análisis automáticamente.

**Parámetros:**
```json
{
  "image_base64": "string (required)"
}
```

**Respuesta Exitosa (200):**
```json
{
  "success": true,
  "person_recognized": true,
  "person_id": 123,
  "person_name": "María López",
  "confidence": 0.94,
  "eyelashes_detected": 16,
  "record_id": 890,
  "analysis": {
    "density": 0.90,
    "average_length": 9.8,
    "curvature": 0.80,
    "thickness": 0.70,
    "coverage": 96.5,
    "health_score": 92.3,
    "characteristics": ["exceptional_thick", "perfect_curve", "optimal_health"]
  },
  "processing_time": 1.25,
  "message": "Persona reconocida y pestañas analizadas automáticamente"
}
```

### GET /face/persons/{person_id}/eyelashes

**Descripción:** Obtiene el historial completo de pestañas de una persona, incluyendo estadísticas y tendencias.

**Path Parameters:**
- `person_id`: int (required) - ID de la persona

**Respuesta Exitosa (200):**
```json
{
  "success": true,
  "person_id": 123,
  "person_name": "María López",
  "total_records": 8,
  "records": [
    {
      "id": 890,
      "created_at": "2025-01-01T12:00:00Z",
      "eyelashes_count": 16,
      "analysis": {
        "health_score": 92.3,
        "density": 0.90,
        "characteristics": ["exceptional_thick", "perfect_curve"]
      },
      "notes": "Análisis después del tratamiento"
    }
  ],
  "statistics": {
    "average_health_score": 89.7,
    "health_trend": "improving",
    "density_trend": "stable", 
    "most_common_characteristics": ["thick", "curved", "healthy"],
    "improvement_rate": 0.15
  },
  "recommendations": [
    "Continue current treatment routine",
    "Consider volumizing mascara",
    "Maintain current curl technique"
  ]
}
```

### GET /face/persons/{person_id}/eyelashes/latest

**Descripción:** Obtiene el análisis más reciente de pestañas de una persona.

**Path Parameters:**
- `person_id`: int (required) - ID de la persona

**Respuesta Exitosa (200):**
```json
{
  "success": true,
  "record": {
    "id": 890,
    "person_id": 123,
    "created_at": "2025-01-01T12:00:00Z",
    "eyelashes_count": 16,
    "analysis": {
      "density": 0.90,
      "average_length": 9.8,
      "curvature": 0.80,
      "thickness": 0.70,
      "coverage": 96.5,
      "health_score": 92.3,
      "characteristics": ["exceptional_thick", "perfect_curve", "optimal_health"]
    },
    "notes": "Análisis después del tratamiento"
  }
}
```

### GET /face/persons/{person_id}/eyelashes/evolution

**Descripción:** Analiza la evolución de las pestañas de una persona comparando registros recientes y generando recomendaciones.

**Path Parameters:**
- `person_id`: int (required) - ID de la persona

**Query Parameters:**
- `limit`: int (default: 5) - Número de registros a analizar

**Respuesta Exitosa (200):**
```json
{
  "success": true,
  "person_id": 123,
  "records_analyzed": 5,
  "time_span_days": 45,
  "health_trend": "improving",
  "density_trend": "increasing",
  "length_trend": "stable",
  "current_health_score": 92.3,
  "previous_health_score": 87.1,
  "improvement_rate": 0.15,
  "evolution_summary": {
    "best_score": 92.3,
    "worst_score": 82.5,
    "average_score": 88.9,
    "consistency": "high"
  },
  "recommendations": [
    "Continue current treatment as results are excellent",
    "Consider lengthening treatments for even better results",
    "Maintain current care routine"
  ],
  "next_analysis_suggested": "2025-01-15T12:00:00Z"
}
```

---

## 🔍 Detección Avanzada de Pestañas

### POST /face/detect/eyelashes

**Descripción:** Detección avanzada de pestañas utilizando múltiples técnicas de visión por computador para alta precisión.

**Parámetros:**
```json
{
  "image_base64": "string (required)",
  "analyze_quality": "boolean (default: false)"
}
```

**Respuesta Exitosa (200):**
```json
{
  "faces_count": 1,
  "eyes_count": 2,
  "faces": [...],
  "eyes": [...],
  "eyelashes": [
    {
      "x": 125,
      "y": 85,
      "width": 8,
      "height": 12,
      "confidence": 0.94
    }
  ],
  "eyelashes_count": 18,
  "quality_analysis": {
    "density": 0.87,
    "average_length": 8.9,
    "health_score": 88.5
  },
  "processing_time_ms": 456.7,
  "annotated_image_base64": "base64_string..."
}
```

### POST /face/analyze/eyelash-quality

**Descripción:** Análisis detallado de calidad de pestañas proporcionando métricas específicas como densidad, longitud, curvatura y puntuación de salud.

**Parámetros:**
```json
{
  "image_base64": "string (required)",
  "eye_coordinates": "[int, int, int, int] (optional) - [x, y, w, h]"
}
```

**Respuesta Exitosa (200):**
```json
{
  "success": true,
  "analysis": {
    "density": 0.89,
    "average_length": 9.3,
    "curvature": 0.76,
    "thickness": 0.68,
    "coverage": 94.7,
    "health_score": 91.2,
    "characteristics": ["very_thick", "well_curved", "excellent_health"],
    "color_uniformity": 0.85,
    "separation": 0.92
  },
  "detailed_metrics": {
    "eyelash_count": 17,
    "average_spacing": 2.3,
    "curl_consistency": 0.78,
    "volume_score": 87.6,
    "symmetry_score": 0.81
  },
  "recommendations": [
    "Excellent natural lash health",
    "Consider volumizing mascara for special occasions",
    "Current care routine is optimal"
  ],
  "processing_time": 678.4
}
```

### POST /face/detect/eyes

**Descripción:** Detección enfocada específicamente en ojos y pestañas con mayor precisión.

**Parámetros:**
```json
{
  "image_base64": "string (required)",
  "include_eyelashes": "boolean (default: true)",
  "high_precision": "boolean (default: false)"
}
```

**Respuesta Exitosa (200):**
```json
{
  "eyes_detected": 2,
  "eyelashes_detected": 22,
  "eyes": [
    {
      "x": 120,
      "y": 80,
      "width": 40,
      "height": 25,
      "eye_type": "left",
      "eyelashes_count": 11
    },
    {
      "x": 200,
      "y": 82,
      "width": 38,
      "height": 24,
      "eye_type": "right", 
      "eyelashes_count": 11
    }
  ],
  "precision_mode": "high",
  "confidence_scores": [0.96, 0.94],
  "processing_time_ms": 723.1,
  "annotated_image_base64": "base64_string..."
}
```

---

## 📷 Escaneo en Tiempo Real

### POST /face/scan/eyelashes/live

**Descripción:** Escanea pestañas en tiempo real con detección y marcado visual. Detecta rostros, marca pestañas con círculos y sugiere puntos de retoque.

**Parámetros:**
```json
{
  "image_base64": "string (required)",
  "session_id": "string (optional)",
  "enable_retouch_detection": "boolean (default: true)",
  "mark_eyelashes": "boolean (default: true)",
  "enhance_contrast": "boolean (default: false)",
  "person_id": "int (optional)"
}
```

**Respuesta Exitosa (200):**
```json
{
  "success": true,
  "frame_processed": true,
  "face_detected": true,
  "eyes_detected": 2,
  "eyelashes_detected": 19,
  "eyelash_points": [
    {
      "x": 125,
      "y": 85,
      "marker_type": "eyelash",
      "color": [0, 0, 255],
      "radius": 8
    }
  ],
  "scan_regions": [
    {
      "x": 100,
      "y": 70,
      "width": 80,
      "height": 40,
      "region_type": "eye_area"
    }
  ],
  "processed_frame": "base64_string_with_markers",
  "retouch_points": [
    {
      "x": 130,
      "y": 88,
      "radius": 5,
      "intensity": 0.8,
      "retouch_type": "enhance",
      "confidence": 0.87
    }
  ],
  "recommendations": [
    "Good lighting detected",
    "Consider slight lengthening treatment",
    "Natural lashes in excellent condition"
  ],
  "processing_time": 234.6,
  "scan_quality": "high",
  "session_id": "session_123456"
}
```

### POST /face/scan/eyelashes/start-session

**Descripción:** Inicia una nueva sesión de escaneo de pestañas para mantener seguimiento de múltiples frames.

**Parámetros:**
```json
{
  "person_id": "int (optional)"
}
```

**Respuesta Exitosa (200):**
```json
{
  "success": true,
  "session_id": "session_789012",
  "person_id": 123,
  "start_time": "2025-01-01T12:00:00Z",
  "status": "active",
  "message": "Sesión de escaneo iniciada exitosamente"
}
```

### GET /face/scan/eyelashes/session/{session_id}

**Descripción:** Obtiene información detallada de una sesión de escaneo.

**Path Parameters:**
- `session_id`: string (required) - ID de la sesión

**Respuesta Exitosa (200):**
```json
{
  "success": true,
  "session": {
    "session_id": "session_789012",
    "person_id": 123,
    "start_time": "2025-01-01T12:00:00Z",
    "duration_minutes": 5.3,
    "frames_processed": 127,
    "total_eyelashes_detected": 2413,
    "average_eyelashes_per_frame": 19.0,
    "retouch_points_suggested": 8,
    "scan_quality_history": ["high", "high", "medium", "high"],
    "status": "active"
  },
  "statistics": {
    "detection_rate": 0.95,
    "average_processing_time": 245.7,
    "quality_consistency": "high"
  }
}
```

### POST /face/scan/eyelashes/end-session/{session_id}

**Descripción:** Finaliza una sesión de escaneo y obtiene un resumen completo.

**Path Parameters:**
- `session_id`: string (required) - ID de la sesión

**Respuesta Exitosa (200):**
```json
{
  "success": true,
  "session_summary": {
    "session_id": "session_789012",
    "duration_total": "00:05:18",
    "frames_processed": 127,
    "total_eyelashes_detected": 2413,
    "average_quality": "high",
    "best_frame_quality": "excellent",
    "retouch_suggestions": 8,
    "recommendations_generated": 15
  },
  "final_analysis": {
    "overall_health_score": 91.3,
    "consistency_score": 0.89,
    "recommended_actions": [
      "Lashes are in excellent condition",
      "Consider light volumizing for special occasions",
      "Maintain current care routine"
    ]
  },
  "session_data_saved": true,
  "end_time": "2025-01-01T12:05:18Z"
}
```

### GET /face/scan/eyelashes/sessions

**Descripción:** Obtiene lista de todas las sesiones de escaneo activas.

**Respuesta Exitosa (200):**
```json
{
  "success": true,
  "active_sessions": 3,
  "sessions": [
    {
      "session_id": "session_789012",
      "person_id": 123,
      "start_time": "2025-01-01T12:00:00Z",
      "frames_processed": 45,
      "status": "active"
    }
  ],
  "total_sessions_today": 12,
  "server_load": "low"
}
```

### POST /face/scan/eyelashes/batch

**Descripción:** Procesa múltiples frames en lote para escaneo de pestañas.

**Parámetros:**
```json
{
  "frames": ["base64_frame1", "base64_frame2", "base64_frame3"],
  "session_id": "string (optional)",
  "enable_retouch_detection": "boolean (default: true)",
  "mark_eyelashes": "boolean (default: true)"
}
```

**Respuesta Exitosa (200):**
```json
{
  "success": true,
  "frames_processed": 3,
  "total_eyelashes_detected": 57,
  "batch_results": [
    {
      "frame_index": 0,
      "eyelashes_detected": 19,
      "scan_quality": "high"
    },
    {
      "frame_index": 1, 
      "eyelashes_detected": 18,
      "scan_quality": "high"
    },
    {
      "frame_index": 2,
      "eyelashes_detected": 20,
      "scan_quality": "excellent"
    }
  ],
  "batch_analysis": {
    "average_eyelashes": 19.0,
    "consistency": "very_high",
    "overall_quality": "excellent"
  },
  "processing_time_total": 687.4,
  "session_id": "session_789012"
}
```

---

## 📊 Gestión de Registros

### GET /face/eyelashes/records/{record_id}

**Descripción:** Obtiene un registro específico de pestañas por ID.

**Path Parameters:**
- `record_id`: int (required) - ID del registro

**Respuesta Exitosa (200):**
```json
{
  "success": true,
  "record": {
    "id": 890,
    "person_id": 123,
    "person_name": "María López",
    "created_at": "2025-01-01T12:00:00Z",
    "eyelashes_count": 16,
    "eyelashes": [
      {
        "x": 125,
        "y": 85,
        "width": 8,
        "height": 12,
        "confidence": 0.94
      }
    ],
    "analysis": {
      "density": 0.90,
      "average_length": 9.8,
      "curvature": 0.80,
      "thickness": 0.70,
      "coverage": 96.5,
      "health_score": 92.3,
      "characteristics": ["exceptional_thick", "perfect_curve"]
    },
    "notes": "Análisis después del tratamiento",
    "image_processed": true
  }
}
```

### GET /face/eyelashes/records/{record_id}/image

**Descripción:** Obtiene la imagen procesada de un registro de pestañas.

**Path Parameters:**
- `record_id`: int (required) - ID del registro

**Respuesta Exitosa (200):**
```json
{
  "success": true,
  "record_id": 890,
  "image_base64": "base64_string_of_processed_image",
  "image_type": "processed_with_markers",
  "processing_applied": [
    "eyelash_detection",
    "quality_markers", 
    "retouch_suggestions"
  ]
}
```

### PUT /face/eyelashes/records/{record_id}/notes

**Descripción:** Actualiza las notas de un registro de pestañas.

**Path Parameters:**
- `record_id`: int (required) - ID del registro

**Parámetros:**
```json
{
  "notes": "string (required)"
}
```

**Respuesta Exitosa (200):**
```json
{
  "success": true,
  "record_id": 890,
  "notes_updated": true,
  "new_notes": "Análisis después del tratamiento - Excelentes resultados",
  "updated_at": "2025-01-01T12:30:00Z"
}
```

### DELETE /face/eyelashes/records/{record_id}

**Descripción:** Elimina un registro de pestañas.

**Path Parameters:**
- `record_id`: int (required) - ID del registro

**Respuesta Exitosa (200):**
```json
{
  "success": true,
  "record_id": 890,
  "deleted": true,
  "message": "Registro de pestañas eliminado exitosamente"
}
```

### GET /face/eyelashes/search

**Descripción:** Busca registros de pestañas por características o notas.

**Query Parameters:**
- `query`: string (required) - Término de búsqueda
- `person_id`: int (optional) - ID de persona para filtrar

**Respuesta Exitosa (200):**
```json
{
  "success": true,
  "query": "excellent health",
  "results_found": 5,
  "records": [
    {
      "id": 890,
      "person_id": 123,
      "person_name": "María López",
      "created_at": "2025-01-01T12:00:00Z",
      "health_score": 92.3,
      "characteristics": ["exceptional_thick", "perfect_curve", "optimal_health"],
      "match_score": 0.95
    }
  ],
  "search_time_ms": 45.2
}
```

---

## 🧪 Items de Prueba

### POST /items/

**Descripción:** Crea un nuevo item de prueba en el sistema.

**Parámetros:**
```json
{
  "title": "string (required)",
  "description": "string (optional)",
  "price": "number (required, > 0)",
  "is_available": "boolean (default: true)"
}
```

**Respuesta Exitosa (201):**
```json
{
  "id": 1,
  "title": "Item de Prueba",
  "description": "Descripción del item",
  "price": 29.99,
  "is_available": true,
  "created_at": "2025-01-01T12:00:00Z"
}
```

### GET /items/

**Descripción:** Obtiene lista de todos los items con paginación.

**Query Parameters:**
- `skip`: int (default: 0, >= 0) - Elementos a omitir
- `limit`: int (default: 10, 1-100) - Máximo elementos a retornar
- `available_only`: boolean (default: false) - Solo items disponibles

**Respuesta Exitosa (200):**
```json
{
  "items": [
    {
      "id": 1,
      "title": "Item 1",
      "description": "Descripción 1",
      "price": 29.99,
      "is_available": true,
      "created_at": "2025-01-01T12:00:00Z"
    }
  ],
  "total": 1,
  "skip": 0,
  "limit": 10
}
```

### GET /items/{item_id}

**Descripción:** Obtiene un item específico por ID.

**Path Parameters:**
- `item_id`: int (required, > 0) - ID del item

**Respuesta Exitosa (200):**
```json
{
  "id": 1,
  "title": "Item de Prueba",
  "description": "Descripción del item",
  "price": 29.99,
  "is_available": true,
  "created_at": "2025-01-01T12:00:00Z"
}
```

### PUT /items/{item_id}

**Descripción:** Actualiza un item existente.

**Path Parameters:**
- `item_id`: int (required, > 0) - ID del item

**Parámetros:**
```json
{
  "title": "string (optional)",
  "description": "string (optional)",
  "price": "number (optional, > 0)",
  "is_available": "boolean (optional)"
}
```

**Respuesta Exitosa (200):**
```json
{
  "id": 1,
  "title": "Item Actualizado",
  "description": "Nueva descripción",
  "price": 39.99,
  "is_available": true,
  "created_at": "2025-01-01T12:00:00Z",
  "updated_at": "2025-01-01T12:30:00Z"
}
```

### DELETE /items/{item_id}

**Descripción:** Elimina un item del sistema.

**Path Parameters:**
- `item_id`: int (required, > 0) - ID del item

**Respuesta Exitosa (200):**
```json
{
  "message": "Item eliminado exitosamente"
}
```

### GET /items/search/query

**Descripción:** Busca items por nombre o descripción.

**Query Parameters:**
- `q`: string (required, min: 2) - Texto a buscar

**Respuesta Exitosa (200):**
```json
[
  {
    "id": 1,
    "title": "Item Encontrado",
    "description": "Descripción que coincide",
    "price": 29.99,
    "is_available": true,
    "created_at": "2025-01-01T12:00:00Z"
  }
]
```

---

## 🛡️ Códigos de Estado HTTP

### Respuestas Exitosas
- **200 OK** - Operación exitosa
- **201 Created** - Recurso creado exitosamente

### Errores del Cliente
- **400 Bad Request** - Solicitud inválida o parámetros incorrectos
- **404 Not Found** - Recurso no encontrado
- **422 Unprocessable Entity** - Error de validación

### Errores del Servidor
- **500 Internal Server Error** - Error interno del servidor

---

## 📝 Notas de Implementación

### Formato de Imágenes
- **Base64**: Preferido para aplicaciones Flutter
- **Archivos**: Soportado para testing y aplicaciones web
- **Formatos**: JPEG, PNG, BMP, TIFF

### Límites y Restricciones
- **Tamaño máximo de imagen**: 10MB
- **Resolución recomendada**: 640x480 a 1920x1080
- **Timeout de procesamiento**: 30 segundos
- **Sesiones activas máximas**: 100

### Optimización
- Use **base64** para Flutter apps
- Use **paginación** para listas grandes
- Implemente **caching** en el cliente
- Use **sesiones** para escaneo continuo

### Seguridad
- Valide siempre el formato de imagen
- Limite el tamaño de las solicitudes
- Use HTTPS en producción
- Implemente rate limiting

---

## 🚀 Inicio Rápido

### 1. Configuración Básica
```bash
# Instalar dependencias
pip install -r requirements.txt

# Iniciar servidor
python main.py
```

### 2. Primer Test
```bash
# Verificar API
curl http://localhost:8000/health

# Ver documentación
# Abrir: http://localhost:8000/docs
```

### 3. Registrar Primera Persona
```python
import requests
import base64

# Registrar persona con imagen
with open("photo.jpg", "rb") as f:
    image_b64 = base64.b64encode(f.read()).decode()

response = requests.post("http://localhost:8000/face/persons/register-with-eyelashes", json={
    "name": "Test Person",
    "email": "test@example.com", 
    "image_base64": image_b64,
    "analyze_eyelashes": True
})

print(response.json())
```

### 4. Análisis en Tiempo Real
```python
# Escanear pestañas en vivo
response = requests.post("http://localhost:8000/face/scan/eyelashes/live", json={
    "image_base64": frame_b64,
    "mark_eyelashes": True,
    "enable_retouch_detection": True
})

result = response.json()
print(f"Pestañas detectadas: {result['eyelashes_detected']}")
```

---

## 🔗 Recursos Adicionales

- **Documentación Interactiva**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc
- **Health Check**: http://localhost:8000/health
- **GitHub Repository**: [Link al repositorio]
- **Support**: [Email de soporte]

---

*Documentación generada automáticamente - Versión 1.0.0*
