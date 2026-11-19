import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';
import { pool } from '../database/db.js';
import { esAdmin } from '../middleware/auth.middleware.js';
import { badRequest } from '../utils/http.js';
import { opcion, idQuery, fechaQuery } from '../utils/validar.js';
import { registrar } from '../utils/auditoria.js';
import { listarProduccion } from './produccion.controllers.js';
import { listarGastos } from './gastos.controllers.js';
import { listarVentas } from './ventas.controllers.js';
import { calcularRentabilidad } from './finanzas.controllers.js';

// ---------------------------------------------------------------- Formatos
const numeroAR = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 });
const monedaAR = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });
const fechaAR = (s) => (s ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}` : '—');
const hoyISO = () => new Date().toISOString().slice(0, 10);

const A_TN = { TN: 1, KG: 0.001, QQ: 0.1 };

// Texto con el que se muestra un valor en el PDF según el tipo de columna
const comoTexto = (valor, tipo) => {
    if (valor === null || valor === undefined || valor === '') return '—';
    switch (tipo) {
        case 'fecha': return fechaAR(valor);
        case 'moneda': return monedaAR.format(valor);
        case 'numero': return numeroAR.format(valor);
        case 'porcentaje': return `${numeroAR.format(valor)} %`;
        default: return String(valor);
    }
};

// ---------------------------------------------------------------- Qué lleva cada reporte
// columnas: { titulo, clave, tipo, peso } · peso = ancho relativo en el PDF
const armarReporte = async (tipo, req) => {
    const admin = esAdmin(req);
    const colEncargado = admin ? [{ titulo: 'Encargado', clave: 'encargado', peso: 1.3 }] : [];

    switch (tipo) {
        case 'produccion': {
            const filas = await listarProduccion(req);
            const tn = filas.reduce((s, f) => s + f.cantidad * A_TN[f.unidad], 0);
            return {
                titulo: 'Reporte de producción',
                columnas: [
                    { titulo: 'Fecha', clave: 'fecha_cosecha', tipo: 'fecha', peso: 0.9 },
                    ...colEncargado,
                    { titulo: 'Finca', clave: 'finca', peso: 1.3 },
                    { titulo: 'Lote', clave: 'lote', peso: 0.9 },
                    { titulo: 'Cultivo', clave: 'cultivo', peso: 1.1 },
                    { titulo: 'Campaña', clave: 'campania', peso: 0.8 },
                    { titulo: 'Cantidad', clave: 'cantidad', tipo: 'numero', peso: 0.9 },
                    { titulo: 'Unidad', clave: 'unidad', peso: 0.6 },
                    { titulo: 'Rendimiento por ha', clave: 'rendimiento_ha', tipo: 'numero', peso: 1 },
                    { titulo: 'Observaciones', clave: 'observaciones', peso: 1.6 },
                ],
                filas,
                resumen: [['Producción total (toneladas)', tn, 'numero']],
            };
        }
        case 'gastos': {
            const filas = await listarGastos(req);
            return {
                titulo: 'Reporte de gastos',
                columnas: [
                    { titulo: 'Fecha', clave: 'fecha', tipo: 'fecha', peso: 0.9 },
                    ...colEncargado,
                    { titulo: 'Finca', clave: 'finca', peso: 1.2 },
                    { titulo: 'Lote', clave: 'lote', peso: 0.8 },
                    { titulo: 'Cultivo', clave: 'cultivo', peso: 1 },
                    { titulo: 'Categoría', clave: 'categoria', peso: 1 },
                    { titulo: 'Concepto', clave: 'concepto', peso: 1.8 },
                    { titulo: 'Proveedor', clave: 'proveedor', peso: 1.2 },
                    { titulo: 'Importe', clave: 'importe', tipo: 'moneda', peso: 1.2 },
                ],
                filas,
                resumen: [['Total gastado', filas.reduce((s, f) => s + f.importe, 0), 'moneda']],
            };
        }
        case 'ventas': {
            const filas = await listarVentas(req);
            return {
                titulo: 'Reporte de ventas',
                columnas: [
                    { titulo: 'Fecha', clave: 'fecha', tipo: 'fecha', peso: 0.9 },
                    ...colEncargado,
                    { titulo: 'Finca', clave: 'finca', peso: 1.2 },
                    { titulo: 'Lote', clave: 'lote', peso: 0.8 },
                    { titulo: 'Cultivo', clave: 'cultivo', peso: 1 },
                    { titulo: 'Comprador', clave: 'cliente', peso: 1.4 },
                    { titulo: 'Cantidad', clave: 'cantidad', tipo: 'numero', peso: 0.9 },
                    { titulo: 'Unidad', clave: 'unidad', peso: 0.6 },
                    { titulo: 'Precio unitario', clave: 'precio_unitario', tipo: 'moneda', peso: 1.2 },
                    { titulo: 'Total', clave: 'total', tipo: 'moneda', peso: 1.3 },
                ],
                filas,
                resumen: [['Total de ingresos', filas.reduce((s, f) => s + f.total, 0), 'moneda']],
            };
        }
        case 'rentabilidad': {
            const r = await calcularRentabilidad(req);
            const etiqueta = { cultivo: 'Cultivo', finca: 'Finca', lote: 'Lote', campania: 'Campaña' }[r.agrupar];
            return {
                titulo: `Reporte de ganancias y pérdidas (por ${etiqueta.toLowerCase()})`,
                columnas: [
                    { titulo: etiqueta, clave: 'nombre', peso: 3 },
                    { titulo: 'Ingresos', clave: 'ingresos', tipo: 'moneda', peso: 1.5 },
                    { titulo: 'Gastos', clave: 'gastos', tipo: 'moneda', peso: 1.5 },
                    { titulo: 'Ganancia', clave: 'ganancia', tipo: 'moneda', peso: 1.5 },
                    { titulo: 'Rentabilidad', clave: 'rentabilidad_pct', tipo: 'porcentaje', peso: 1.2 },
                ],
                filas: r.grupos,
                filaTotal: { nombre: 'Total', ...r.totales },
                resumen: [],
            };
        }
        default:
            throw badRequest('Reporte desconocido. Los disponibles son: produccion, gastos, ventas y rentabilidad');
    }
};

// Frases con los filtros aplicados, para que quien lea el reporte sepa qué está viendo
const describirFiltros = async (req) => {
    const q = req.query;
    const partes = [];
    const nombre = async (sql, id) => (id ? (await pool.query(sql, [id]))[0][0] : null);

    const finca = await nombre('SELECT nombre FROM finca WHERE idFINCA = ?', idQuery(q.finca));
    if (finca) partes.push(`Finca: ${finca.nombre}`);
    const enc = esAdmin(req) ? await nombre("SELECT CONCAT(nombre, ' ', apellido) AS nombre FROM usuario WHERE idUSUARIO = ?", idQuery(q.encargado)) : null;
    if (enc) partes.push(`Encargado: ${enc.nombre}`);
    const cultivo = await nombre('SELECT nombre FROM cultivo WHERE idCULTIVO = ?', idQuery(q.cultivo));
    if (cultivo) partes.push(`Cultivo: ${cultivo.nombre}`);
    const categoria = await nombre('SELECT nombre FROM categoria_gasto WHERE idCATEGORIA = ?', idQuery(q.categoria));
    if (categoria) partes.push(`Categoría: ${categoria.nombre}`);
    const desde = fechaQuery(q.desde);
    const hasta = fechaQuery(q.hasta);
    if (desde) partes.push(`Desde: ${fechaAR(desde)}`);
    if (hasta) partes.push(`Hasta: ${fechaAR(hasta)}`);

    if (!partes.length) partes.push('Sin filtros: todos los registros');
    if (!esAdmin(req)) partes.push('Solo datos de tus fincas');
    return partes.join(' · ');
};

// ---------------------------------------------------------------- PDF
const COLOR = { verde: '#10281c', texto: '#131f18', suave: '#55625a', zebra: '#f3f4ef', borde: '#e1e3dc' };

const generarPdf = (res, spec, meta) => {
    const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 36, bufferPages: true, info: { Title: spec.titulo, Author: 'AgroPulse' } });
    doc.pipe(res);

    const margen = 36;
    const ancho = doc.page.width - margen * 2;
    const pesoTotal = spec.columnas.reduce((s, c) => s + c.peso, 0);
    const anchos = spec.columnas.map((c) => (c.peso / pesoTotal) * ancho);
    const alinear = (c) => (['numero', 'moneda', 'porcentaje'].includes(c.tipo) ? 'right' : 'left');
    const limiteY = () => doc.page.height - 56;

    // Encabezado del reporte
    doc.font('Helvetica-Bold').fontSize(18).fillColor(COLOR.verde).text(spec.titulo, margen, margen);
    doc.font('Helvetica').fontSize(9).fillColor(COLOR.suave)
        .text(`AgroPulse · Generado el ${meta.generado} por ${meta.usuario}`, margen, doc.y + 2)
        .text(meta.filtros, margen, doc.y + 1, { width: ancho });
    doc.moveDown(0.8);

    let y = doc.y;
    const dibujarCabecera = () => {
        doc.rect(margen, y, ancho, 22).fill(COLOR.verde);
        let x = margen;
        spec.columnas.forEach((c, i) => {
            doc.font('Helvetica-Bold').fontSize(8).fillColor('#ffffff')
                .text(c.titulo, x + 4, y + 7, { width: anchos[i] - 8, align: alinear(c), lineBreak: false, ellipsis: true });
            x += anchos[i];
        });
        y += 22;
    };

    // Dibuja una fila; si no entra en la página, abre una nueva y repite la cabecera
    const dibujarFila = (textos, { negrita = false, zebra = false } = {}) => {
        doc.font(negrita ? 'Helvetica-Bold' : 'Helvetica').fontSize(8);
        const alto = Math.max(...textos.map((t, i) => doc.heightOfString(t, { width: anchos[i] - 8 }))) + 9;
        if (y + alto > limiteY()) {
            doc.addPage();
            y = margen;
            dibujarCabecera();
        }
        if (zebra) doc.rect(margen, y, ancho, alto).fill(COLOR.zebra);
        let x = margen;
        textos.forEach((t, i) => {
            doc.font(negrita ? 'Helvetica-Bold' : 'Helvetica').fontSize(8).fillColor(COLOR.texto)
                .text(t, x + 4, y + 4.5, { width: anchos[i] - 8, align: alinear(spec.columnas[i]) });
            x += anchos[i];
        });
        doc.moveTo(margen, y + alto).lineTo(margen + ancho, y + alto).lineWidth(0.4).strokeColor(COLOR.borde).stroke();
        y += alto;
    };

    dibujarCabecera();
    if (!spec.filas.length) {
        doc.font('Helvetica').fontSize(10).fillColor(COLOR.suave).text('No hay registros para los filtros elegidos.', margen, y + 14);
        y += 30;
    }
    spec.filas.forEach((fila, n) => dibujarFila(spec.columnas.map((c) => comoTexto(fila[c.clave], c.tipo)), { zebra: n % 2 === 1 }));
    if (spec.filaTotal) dibujarFila(spec.columnas.map((c) => comoTexto(spec.filaTotal[c.clave], c.tipo)), { negrita: true });

    // Totales debajo de la tabla
    if (spec.resumen.length) {
        if (y + 40 > limiteY()) {
            doc.addPage();
            y = margen;
        }
        y += 12;
        spec.resumen.forEach(([etiqueta, valor, tipo]) => {
            doc.font('Helvetica-Bold').fontSize(10).fillColor(COLOR.verde).text(`${etiqueta}: ${comoTexto(valor, tipo)}`, margen, y, { width: ancho, align: 'right' });
            y += 15;
        });
    }

    // Pie con el número de página (se quita el margen inferior para que no abra páginas nuevas)
    const { start, count } = doc.bufferedPageRange();
    for (let i = start; i < start + count; i++) {
        doc.switchToPage(i);
        doc.page.margins.bottom = 0;
        doc.font('Helvetica').fontSize(8).fillColor(COLOR.suave)
            .text(`Página ${i + 1} de ${count}`, margen, doc.page.height - 28, { width: ancho, align: 'right', lineBreak: false });
    }
    doc.end();
};

// ---------------------------------------------------------------- Excel
const FORMATO_EXCEL = { fecha: 'dd/mm/yyyy', moneda: '"$" #,##0.00', numero: '#,##0.00', porcentaje: '0.0"%"' };

const aValorExcel = (valor, tipo) => {
    if (valor === null || valor === undefined || valor === '') return null;
    if (tipo === 'fecha') return new Date(Date.UTC(+valor.slice(0, 4), +valor.slice(5, 7) - 1, +valor.slice(8, 10)));
    return valor;
};

const generarExcel = async (res, spec, meta) => {
    const libro = new ExcelJS.Workbook();
    libro.creator = 'AgroPulse';
    const hoja = libro.addWorksheet(spec.titulo.replace(/[\\/?*[\]:]/g, '').slice(0, 31));
    const n = spec.columnas.length;

    hoja.addRow([spec.titulo]).font = { bold: true, size: 14, color: { argb: 'FF10281C' } };
    hoja.addRow([`AgroPulse · Generado el ${meta.generado} por ${meta.usuario}`]).font = { size: 9, color: { argb: 'FF55625A' } };
    hoja.addRow([meta.filtros]).font = { size: 9, color: { argb: 'FF55625A' } };
    hoja.addRow([]);

    const cabecera = hoja.addRow(spec.columnas.map((c) => c.titulo));
    cabecera.eachCell((celda, i) => {
        celda.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF10281C' } };
        celda.alignment = { horizontal: ['numero', 'moneda', 'porcentaje'].includes(spec.columnas[i - 1].tipo) ? 'right' : 'left', vertical: 'middle' };
    });

    const agregar = (fila, negrita = false) => {
        const f = hoja.addRow(spec.columnas.map((c) => aValorExcel(fila[c.clave], c.tipo)));
        f.eachCell({ includeEmpty: true }, (celda, i) => {
            const tipo = spec.columnas[i - 1]?.tipo;
            if (tipo) celda.numFmt = FORMATO_EXCEL[tipo];
            if (negrita) celda.font = { bold: true };
        });
    };
    spec.filas.forEach((f) => agregar(f));
    if (spec.filaTotal) agregar(spec.filaTotal, true);

    if (spec.resumen.length) {
        hoja.addRow([]);
        spec.resumen.forEach(([etiqueta, valor, tipo]) => {
            const f = hoja.addRow([]);
            f.getCell(n - 1).value = etiqueta;
            f.getCell(n - 1).font = { bold: true };
            f.getCell(n - 1).alignment = { horizontal: 'right' };
            f.getCell(n).value = valor;
            f.getCell(n).numFmt = FORMATO_EXCEL[tipo];
            f.getCell(n).font = { bold: true };
        });
    }

    spec.columnas.forEach((c, i) => {
        hoja.getColumn(i + 1).width = Math.round(c.peso * 14) + 4;
    });
    hoja.views = [{ state: 'frozen', ySplit: cabecera.number }];
    if (spec.filas.length) hoja.autoFilter = { from: { row: cabecera.number, column: 1 }, to: { row: cabecera.number, column: n } };

    await libro.xlsx.write(res);
    res.end();
};

// ---------------------------------------------------------------- Endpoint (RF 27)
// GET /reportes/:tipo?formato=pdf|xlsx + los mismos filtros de cada listado.
// Usa las mismas consultas que las pantallas, así cada usuario recibe solo lo que puede ver.
export const generarReporte = async (req, res) => {
    const formato = opcion(req.query.formato, ['PDF', 'XLSX'], 'El formato', { porDefecto: 'PDF' }).toLowerCase();
    const spec = await armarReporte(req.params.tipo, req);

    const [u] = await pool.query("SELECT CONCAT(nombre, ' ', apellido) AS nombre FROM usuario WHERE idUSUARIO = ?", [req.usuario.id]);
    const meta = {
        generado: new Date().toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Argentina/Tucuman' }),
        usuario: u[0]?.nombre ?? 'usuario',
        filtros: await describirFiltros(req),
    };

    const archivo = `agropulse-${req.params.tipo}-${hoyISO()}.${formato}`;
    res.setHeader('Content-Disposition', `attachment; filename="${archivo}"`);
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
    res.setHeader('Content-Type', formato === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

    registrar({
        usuarioId: req.usuario.id,
        accion: 'EXPORTAR',
        entidad: 'reporte',
        detalle: `Reporte de ${req.params.tipo} en ${formato.toUpperCase()} (${spec.filas.length} filas)`,
        ip: req.ip,
    });

    if (formato === 'pdf') generarPdf(res, spec, meta);
    else await generarExcel(res, spec, meta);
};
