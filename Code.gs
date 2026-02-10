// MOD-001: ENCABEZADO [INICIO]
/*
*****************************************
PROYECTO: Plan Base Estudio
ARCHIVO: Code.gs
VERSIÓN: 01.00
FECHA: 10/02/2026 09:45 (UTC-5)
*****************************************
*/
// MOD-001: FIN

// MOD-002: Enrutador doGet y URL de la app [INICIO]
// Función principal que maneja las peticiones GET
function doGet(e) {
  const page = e.parameter.page;

  // Página de Malla Matriz
  if (page === 'matriz') {
    return HtmlService.createHtmlOutputFromFile('MallaMatriz')
      .setTitle('Cargar Malla Matriz')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  // Página de Malla Estudiante
  if (page === 'estudiante') {
    return HtmlService.createHtmlOutputFromFile('MallaEstudiante')
      .setTitle('Mi Malla Curricular')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  // Página de Gestión (por defecto)
  return HtmlService.createHtmlOutputFromFile('Gestion')
    .setTitle('Gestión de Malla Curricular')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// Obtener URL de la aplicación
function obtenerUrlApp() {
  return ScriptApp.getService().getUrl();
}
// MOD-002: FIN

// MOD-003: Auxiliares de generación y verificación de codes [INICIO]
// Generar 6 letras aleatorias
function generarLetrasAleatorias() {
  const letras = 'abcdefghijklmnopqrstuvwxyz';
  let resultado = '';
  for (let i = 0; i < 6; i++) {
    resultado += letras.charAt(Math.floor(Math.random() * letras.length));
  }
  return resultado;
}

// Obtener el siguiente número consecutivo
function obtenerSiguienteNumero() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Estudiantes');
  const data = sheet.getDataRange().getValues();

  let maxNumero = 0;

  // Buscar en la columna E (Code) el número más alto
  for (let i = 1; i < data.length; i++) {
    if (data[i][4]) { // Columna E (índice 4)
      const code = data[i][4].toString();
      // Extraer el número del code (ejemplo: "abcdef123" -> 123)
      const match = code.match(/\d+$/);
      if (match) {
        const numero = parseInt(match[0]);
        if (numero > maxNumero) {
          maxNumero = numero;
        }
      }
    }
  }

  return maxNumero + 1;
}

// Generar un code único
function generarCodeUnico() {
  const letras = generarLetrasAleatorias();
  const numero = obtenerSiguienteNumero();
  return letras + numero;
}

// Verificar si un código ya existe
function verificarCodeExiste(code) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Estudiantes');
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (data[i][4] && data[i][4].toString().toLowerCase() === code.toLowerCase()) {
      return true;
    }
  }

  return false;
}
// MOD-003: FIN

// MOD-004: Cargar Malla Matriz desde URL de Google Sheet [INICIO]
function cargarMallaMatrizDesdeURL(institucion, carrera, urlSheet) {
  try {
    // Extraer el ID del Google Sheet de la URL
    const regex = /\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/;
    const match = urlSheet.match(regex);

    if (!match) {
      return { success: false, message: 'URL de Google Sheet no válida' };
    }

    const sheetId = match[1];
    const ss = SpreadsheetApp.openById(sheetId);
    const sheet = ss.getSheets()[0]; // Primera hoja
    const data = sheet.getDataRange().getValues();

    // Verificar que tenga las cabeceras correctas
    if (data.length < 2) {
      return { success: false, message: 'El Google Sheet está vacío' };
    }

    // Si institución y carrera están vacías, tomarlas del sheet
    const institutoSheet = data[0][0] || institucion;
    const carreraSheet = data[0][1] || carrera;

    // Procesar los datos (saltar primera fila de cabeceras)
    const cursos = [];
    for (let i = 1; i < data.length; i++) {
      if (data[i][2] && data[i][3]) { // Si tiene Nivel y Curso
        cursos.push({
          instituto: institucion || institutoSheet,
          carrera: carrera || carreraSheet,
          nivel: data[i][2],
          curso: data[i][3],
          creditos: data[i][4] || 3
        });
      }
    }

    if (cursos.length === 0) {
      return { success: false, message: 'No se encontraron cursos válidos en el Google Sheet' };
    }

    // Guardar en hoja Matriz e Institutos
    guardarEnMatriz(cursos);
    guardarInstitutoCarrera(institucion || institutoSheet, carrera || carreraSheet);

    return {
      success: true,
      message: `Se cargaron ${cursos.length} cursos exitosamente`,
      cursos: cursos.length
    };

  } catch (error) {
    return {
      success: false,
      message: 'Error al cargar desde URL: ' + error.toString()
    };
  }
}
// MOD-004: FIN

// MOD-005: Cargar Malla Matriz desde datos CSV [INICIO]
function cargarMallaMatrizDesdeCSV(institucion, carrera, csvData) {
  try {
    const lines = csvData.split('\n');

    if (lines.length < 2) {
      return { success: false, message: 'El archivo está vacío' };
    }

    const cursos = [];

    // Procesar líneas (saltar cabecera)
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const cols = line.split(',');
      if (cols.length >= 5 && cols[2] && cols[3]) {
        cursos.push({
          instituto: institucion || cols[0],
          carrera: carrera || cols[1],
          nivel: cols[2].trim(),
          curso: cols[3].trim(),
          creditos: parseInt(cols[4]) || 3
        });
      }
    }

    if (cursos.length === 0) {
      return { success: false, message: 'No se encontraron cursos válidos' };
    }

    // Guardar en hoja Matriz e Institutos
    guardarEnMatriz(cursos);
    const inst = institucion || cursos[0].instituto;
    const carr = carrera || cursos[0].carrera;
    guardarInstitutoCarrera(inst, carr);

    return {
      success: true,
      message: `Se cargaron ${cursos.length} cursos exitosamente`,
      cursos: cursos.length
    };

  } catch (error) {
    return {
      success: false,
      message: 'Error al procesar CSV: ' + error.toString()
    };
  }
}
// MOD-005: FIN

// MOD-006: Guardar en hoja Matriz e Institutos [INICIO]
// Guardar cursos en hoja Matriz
function guardarEnMatriz(cursos) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Matriz');

  // Obtener última fila con datos
  const lastRow = sheet.getLastRow();

  // Preparar datos para insertar
  const dataToInsert = cursos.map(curso => [
    curso.instituto,
    curso.carrera,
    curso.nivel,
    curso.curso,
    curso.creditos
  ]);

  // Insertar datos
  if (dataToInsert.length > 0) {
    sheet.getRange(lastRow + 1, 1, dataToInsert.length, 5).setValues(dataToInsert);
  }
}

// Guardar Instituto y Carrera en hoja Institutos
function guardarInstitutoCarrera(instituto, carrera) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Institutos');

  // Verificar si ya existe la combinación
  const data = sheet.getDataRange().getValues();
  let existe = false;

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === instituto && data[i][1] === carrera) {
      existe = true;
      break;
    }
  }

  // Si no existe, agregar
  if (!existe) {
    const lastRow = sheet.getLastRow();
    sheet.getRange(lastRow + 1, 1, 1, 2).setValues([[instituto, carrera]]);
  }
}
// MOD-006: FIN

// MOD-007: Leer institutos y carreras [INICIO]
// Obtener lista de institutos
function obtenerInstitutos() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Institutos');
  const data = sheet.getDataRange().getValues();

  const institutos = [];
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] && !institutos.includes(data[i][0])) {
      institutos.push(data[i][0]);
    }
  }

  return institutos;
}

// Obtener carreras de un instituto
function obtenerCarrerasPorInstituto(instituto) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Institutos');
  const data = sheet.getDataRange().getValues();

  const carreras = [];
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === instituto && data[i][1] && !carreras.includes(data[i][1])) {
      carreras.push(data[i][1]);
    }
  }

  return carreras;
}
// MOD-007: FIN

// MOD-008: Generar malla del estudiante [INICIO]
// Generar malla para un estudiante (con clave personalizada opcional)
function generarMallaEstudiante(nombre, instituto, carrera, clavepersonalizada) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    let code;

    // Si se proporcionó una clave personalizada
    if (clavepersonalizada && clavepersonalizada.trim() !== '') {
      code = clavepersonalizada.trim().toLowerCase();

      // Verificar si ya existe
      if (verificarCodeExiste(code)) {
        return {
          success: false,
          claveExiste: true,
          message: 'La clave ya existe. Por favor usa otra clave.'
        };
      }
    } else {
      // Generar código automático
      code = generarCodeUnico();
    }

    // Guardar datos del estudiante
    const sheetEstudiantes = ss.getSheetByName('Estudiantes');
    const fecha = Utilities.formatDate(new Date(), 'GMT-5', 'dd/MM/yyyy');
    sheetEstudiantes.appendRow([fecha, nombre, instituto, carrera, code]);

    // Copiar malla desde Matriz a Malla
    copiarMallaDesdeMatriz(code, nombre, instituto, carrera);

    return {
      success: true,
      code: code
    };

  } catch (error) {
    return {
      success: false,
      message: 'Error al generar malla: ' + error.toString()
    };
  }
}

// Copiar malla desde Matriz a Malla del estudiante
function copiarMallaDesdeMatriz(code, nombre, instituto, carrera) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetMatriz = ss.getSheetByName('Matriz');
  const sheetMalla = ss.getSheetByName('Malla');

  // Obtener cursos de la Matriz para este instituto y carrera
  const dataMatriz = sheetMatriz.getDataRange().getValues();

  const cursosEstudiante = [];
  for (let i = 1; i < dataMatriz.length; i++) {
    if (dataMatriz[i][0] === instituto && dataMatriz[i][1] === carrera) {
      cursosEstudiante.push([
        code,              // Code
        nombre,            // Nombre
        dataMatriz[i][0],  // Instituto
        dataMatriz[i][1],  // Carrera
        dataMatriz[i][2],  // Nivel
        dataMatriz[i][3],  // Curso
        dataMatriz[i][4],  // Créditos
        '',                // Estado (vacío por defecto)
        ''                 // Visible (vacío por defecto)
      ]);
    }
  }

  // Insertar cursos en hoja Malla
  if (cursosEstudiante.length > 0) {
    const lastRow = sheetMalla.getLastRow();
    sheetMalla.getRange(lastRow + 1, 1, cursosEstudiante.length, 9).setValues(cursosEstudiante);
  }
}
// MOD-008: FIN

// MOD-009: Obtener y consultar estudiantes [INICIO]
// Obtener todos los estudiantes
function obtenerEstudiantes() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Estudiantes');
  const data = sheet.getDataRange().getValues();

  const estudiantes = [];
  for (let i = 1; i < data.length; i++) {
    if (data[i][1]) { // Si tiene nombre
      // Formatear fecha si es necesario
      let fecha = data[i][0];
      if (fecha instanceof Date) {
        fecha = Utilities.formatDate(fecha, 'GMT-5', 'dd/MM/yyyy');
      }

      estudiantes.push({
        fecha: fecha || '',
        nombre: data[i][1] || '',
        instituto: data[i][2] || '',
        carrera: data[i][3] || '',
        code: data[i][4] || ''
      });
    }
  }

  // Ordenar alfabéticamente por nombre
  estudiantes.sort((a, b) => a.nombre.localeCompare(b.nombre));

  return estudiantes;
}

// Consultar estudiantes con filtros
function consultarEstudiantes(filtroNombre, filtroInstituto, filtroCarrera) {
  try {
    const estudiantes = obtenerEstudiantes();

    // Si no hay estudiantes, retornar array vacío
    if (!estudiantes || estudiantes.length === 0) {
      return [];
    }

    const resultado = estudiantes.filter(est => {
      let cumple = true;

      // Filtro por nombre (búsqueda parcial)
      if (filtroNombre && filtroNombre.trim() !== '') {
        const nombreLower = (est.nombre || '').toLowerCase();
        const filtroLower = filtroNombre.toLowerCase();
        cumple = cumple && nombreLower.includes(filtroLower);
      }

      // Filtro por instituto (coincidencia exacta)
      if (filtroInstituto && filtroInstituto.trim() !== '') {
        cumple = cumple && (est.instituto === filtroInstituto);
      }

      // Filtro por carrera (coincidencia exacta)
      if (filtroCarrera && filtroCarrera.trim() !== '') {
        cumple = cumple && (est.carrera === filtroCarrera);
      }

      return cumple;
    });

    return resultado;

  } catch (error) {
    Logger.log('Error en consultarEstudiantes: ' + error.toString());
    return [];
  }
}
// MOD-009: FIN

// MOD-010: Leer datos y malla del estudiante [INICIO]
// Obtener datos del estudiante por code
function obtenerDatosEstudiante(code) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheetMalla = ss.getSheetByName('Malla');
    const data = sheetMalla.getDataRange().getValues();

    // Buscar cualquier registro con este code en la columna A
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] && data[i][0].toString().toLowerCase() === code.toLowerCase()) {
        return {
          success: true,
          code: data[i][0],
          nombre: data[i][1],
          instituto: data[i][2],
          carrera: data[i][3]
        };
      }
    }

    return { success: false };

  } catch (error) {
    return { success: false };
  }
}

// Obtener malla del estudiante
function obtenerMallaEstudiante(code) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Malla');
  const data = sheet.getDataRange().getValues();

  const cursos = [];
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] && data[i][0].toString().toLowerCase() === code.toLowerCase()) {
      cursos.push({
        code: data[i][0],
        nombre: data[i][1],
        instituto: data[i][2],
        carrera: data[i][3],
        nivel: data[i][4],
        curso: data[i][5],
        creditos: data[i][6],
        estado: data[i][7] || '',
        visible: data[i][8] || '',
        fila: i + 1
      });
    }
  }

  return cursos;
}
// MOD-010: FIN

// MOD-011: Guardar cambios y visibilidad de malla [INICIO]
// Guardar cambios en la malla del estudiante (masivo)
function guardarCambiosMalla(code, cambios) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('Malla');

    for (let i = 0; i < cambios.length; i++) {
      const cambio = cambios[i];

      if (cambio.curso !== undefined) {
        sheet.getRange(cambio.fila, 6).setValue(cambio.curso);
      }
      if (cambio.creditos !== undefined) {
        sheet.getRange(cambio.fila, 7).setValue(cambio.creditos);
      }
      if (cambio.estado !== undefined) {
        // Forzar como texto con apóstrofe para evitar conversión a fecha
        const estadoTexto = cambio.estado ? "'" + cambio.estado : '';
        sheet.getRange(cambio.fila, 8).setValue(estadoTexto);
      }
      if (cambio.visible !== undefined) {
        sheet.getRange(cambio.fila, 9).setValue(cambio.visible);
      }
    }

    return { success: true, message: 'Cambios guardados exitosamente' };

  } catch (error) {
    return {
      success: false,
      message: 'Error al guardar cambios: ' + error.toString()
    };
  }
}

// Actualizar visibilidad de nivel completo
function actualizarVisibilidadNivel(code, nivel, visible) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('Malla');
    const data = sheet.getDataRange().getValues();

    const valorVisible = visible ? 'visible' : '';

    for (let i = 1; i < data.length; i++) {
      if (data[i][0] && data[i][0].toString().toLowerCase() === code.toLowerCase() && data[i][4] === nivel) {
        sheet.getRange(i + 1, 9).setValue(valorVisible);
      }
    }

    return { success: true };
  } catch (error) {
    return { success: false, message: error.toString() };
  }
}
// MOD-011: FIN

// MOD-012: Verificar clave de administrador [INICIO]
function verificarClaveAdmin(clave) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('Admin');
    const claveCorrecta = sheet.getRange('B2').getValue();

    // Log para debug
    Logger.log('=== DEBUG VERIFICACIÓN CLAVE ===');
    Logger.log('Clave ingresada: [' + clave + ']');
    Logger.log('Clave correcta: [' + claveCorrecta + ']');
    Logger.log('Tipo clave ingresada: ' + typeof clave);
    Logger.log('Tipo clave correcta: ' + typeof claveCorrecta);

    // Registrar intento de acceso en columna C2
    const fecha = Utilities.formatDate(new Date(), 'GMT-5', 'dd/MM/yyyy HH:mm:ss');
    sheet.getRange('C2').setValue(fecha);

    // Comparar claves (convertir ambas a string y quitar espacios)
    const claveIngresadaLimpia = clave ? clave.toString().trim() : '';
    const claveCorrectaLimpia = claveCorrecta ? claveCorrecta.toString().trim() : '';

    Logger.log('Clave ingresada limpia: [' + claveIngresadaLimpia + ']');
    Logger.log('Clave correcta limpia: [' + claveCorrectaLimpia + ']');
    Logger.log('¿Son iguales? ' + (claveIngresadaLimpia === claveCorrectaLimpia));

    if (claveIngresadaLimpia === claveCorrectaLimpia && claveIngresadaLimpia !== '') {
      Logger.log('✅ Acceso concedido');
      return { success: true };
    } else {
      Logger.log('❌ Acceso denegado');
      return { success: false };
    }
  } catch (error) {
    Logger.log('❌ Error en verificación: ' + error.toString());
    return { success: false, message: 'Error al verificar clave' };
  }
}
// MOD-012: FIN

// MOD-099: NOTAS [INICIO]
/*
DESCRIPCIÓN:
Backend Google Apps Script para el sistema Plan Base Estudio.
Gestiona mallas curriculares, estudiantes y autenticación de administrador.

MÓDULOS:
- MOD-003: Enrutador de páginas HTML (doGet) y URL de la app
- MOD-004: Auxiliares de generación y verificación de codes de estudiante
- MOD-005: Carga de Malla Matriz desde URL de Google Sheet
- MOD-006: Carga de Malla Matriz desde archivo CSV
- MOD-007: Escritura en hojas Matriz e Institutos
- MOD-008: Lectura de institutos y carreras disponibles
- MOD-009: Generación de malla personalizada por estudiante
- MOD-010: Consulta y filtrado de estudiantes registrados
- MOD-011: Lectura de datos y malla del estudiante (web)
- MOD-012: Guardado de cambios y visibilidad en malla del estudiante
- MOD-013: Verificación de clave de administrador

HOJAS REQUERIDAS EN SPREADSHEET:
- Estudiantes: fecha, nombre, instituto, carrera, code
- Matriz: instituto, carrera, nivel, curso, creditos
- Malla: code, nombre, instituto, carrera, nivel, curso, creditos, estado, visible
- Institutos: instituto, carrera
- Admin: clave en B2, último acceso en C2
*/
// MOD-099: FIN
