
export interface IPermissionRequest {
  name: string;
}

export interface IPermissionResponse {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export type IPermission =
  // App permissions (backend)
  | "clients:view"
  | "catalog:view"
  | "catalog:manage"
  | "tracking:view"
  | "forms:view"
  | "users:manage"
  | "settings:view"

  // Usuario
  | "usuario_listar"
  | "usuario_ver"
  | "usuario_crear"
  | "usuario_editar"
  | "usuario_eliminar"
  | "usuario_restaurar"

  // Rol
  | "rol_listar"
  | "rol_ver"
  | "rol_crear"
  | "rol_editar"
  | "rol_eliminar"

  // Permiso
  | "permiso_listar"
  | "permiso_ver"

  // Rol-Permiso
  | "rol_permiso_listar"
  | "rol_permiso_editar"

  // Usuario-Rol
  | "usuario_rol_listar"
  | "usuario_rol_editar"

  // Evento
  | "evento_listar"
  | "evento_ver"
  | "evento_crear"
  | "evento_editar"
  | "evento_eliminar"

  // Curso
  | "curso_listar"
  | "curso_ver"
  | "curso_crear"
  | "curso_editar"
  | "curso_eliminar"

  // Comunicado
  | "comunicado_listar"
  | "comunicado_ver"
  | "comunicado_crear"
  | "comunicado_editar"
  | "comunicado_eliminar"

  // Tipo Evento
  | "tipo_evento_listar"
  | "tipo_evento_ver"
  | "tipo_evento_crear"
  | "tipo_evento_editar"
  | "tipo_evento_eliminar"

  //WEB

  // Principio
  | "principio_listar"
  | "principio_ver"
  | "principio_crear"
  | "principio_editar"
  | "principio_eliminar"
  
  // Contacto
  | "contacto_listar"
  | "contacto_ver"
  | "contacto_crear"
  | "contacto_editar"
  | "contacto_eliminar" 

  // Historia
  | "historia_listar"
  | "historia_ver"
  | "historia_crear"
  | "historia_editar"
  | "historia_eliminar"

  // Valor Moral
  | "valor_moral_listar"
  | "valor_moral_ver"
  | "valor_moral_crear"
  | "valor_moral_editar"
  | "valor_moral_eliminar"

  // Acuerdo
  | "acuerdo_listar"
  | "acuerdo_ver"
  | "acuerdo_crear"
  | "acuerdo_editar"
  | "acuerdo_eliminar" 

  // Contacto
  | "contacto_listar"
  | "contacto_ver"
  | "contacto_crear"
  | "contacto_editar"
  | "contacto_eliminar" 

  // Consulta
  | "consulta_listar"
  | "consulta_ver"
  | "consulta_crear"
  | "consulta_editar"
  | "consulta_eliminar" 

  // Directiva
  | "directiva_listar"
  | "directiva_ver"
  | "directiva_crear"
  | "directiva_editar"
  | "directiva_eliminar" 

  // Requisito
  | "requisito_listar"
  | "requisito_ver"
  | "requisito_crear"
  | "requisito_editar"
  | "requisito_eliminar" 

  // Banner
  | "banner_listar"
  | "banner_ver"
  | "banner_crear"
  | "banner_editar"
  | "banner_eliminar" 

  // Pregunta Frecuente
  | "pregunta_frecuente_listar"
  | "pregunta_frecuente_ver"
  | "pregunta_frecuente_crear"
  | "pregunta_frecuente_editar"
  | "pregunta_frecuente_eliminar" 

  // Red Social
  | "red_social_listar"
  | "red_social_ver"
  | "red_social_crear"
  | "red_social_editar"
  | "red_social_eliminar" 

  // Profesión
  | "profesion_listar"
  | "profesion_ver"
  | "profesion_crear"
  | "profesion_editar"
  | "profesion_eliminar" 

    // Pagos
  | "payment_listar"
  | "payment_ver"
  | "payment_crear"
  | "payment_editar"
  | "payment_eliminar"
  | "payment_restaurar"
  ;
