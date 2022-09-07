const registerService = require('./service/register');
const loginService = require('./service/login');
const verifyService = require('./service/verify');
const util = require('./utils/util');
const addUserService = require('./service/addUsuario');
const getUsuariosService = require('./service/getUsuarios');
const actividadesService = require('./service/actividadesService');
const alexaService = require('./service/alexaFunctionsService');
const notificacionesService = require("./service/notificacionesService");
const recompensasService = require('./service/recompensasService');
const retosService = require('./service/retosService');

const healthPath = '/health';
const registerPath = '/register';
const loginPath = '/login';
const verifyPath = '/verify';
const addUserPath = '/add-usuario';
const getUsuariosByCPath = '/get-usuarios-c';
const getUsuariosByUUIDPath = '/get-usuario-id';
const addActividadPath = '/add-actividad';
const getActividadesByUserIDPath = '/get-actividades-user';
const getActividadesUserHoyPath = '/get-actividades-hoy';
const getActividadesCompletadasUserHoyPath = '/get-actividades-hoy-c-comp';
const completarActividadPath = '/completar-actividad';
const getActividadByIDPath = '/get-actividad-id';
const deleteActividadPath = '/eliminar-actividad';
const vincularAlexaPath = '/vincular-alexa';
const getNotificacionesByUserPath = '/get-notificaciones-user';
const marcarNotificacionLeidaPath = '/marcar-notificacion-leida';
const addRecompensaPath = '/add-recompensa';
const getRecompensasUserPath = '/get-recompensas-user';
const getRecompensaIdPath = '/get-recompensa-id';
const addRetoPath = '/add-reto';
const getRetosPath = '/get-retos';
const getRetosPersonalizadosPath = '/get-retos-personalizados'
const getRetosCompletadosPath = '/get-retos-completados'

exports.handler = async (event) => {
    console.log('Request Event: ' + JSON.stringify(event));
    let response;
    switch (true) {
        case event.source == "aws.events" && event["detail-type"] === "Scheduled Event":
            response = await notificacionesService.crearNotificaciones();
            break;
        case event.httpMethod === 'POST' && event.path === getNotificacionesByUserPath:
            const getNotificacionesBody = JSON.parse(event.body);
            response = await notificacionesService.getNotificacionesByUserIDHoy(getNotificacionesBody);
            break;
        case event.httpMethod === 'POST' && event.path === marcarNotificacionLeidaPath:
            const marcarLeidaBody = JSON.parse(event.body);
            response = await notificacionesService.marcarNotificacionLeida(marcarLeidaBody);
            break;
        case event.httpMethod === 'POST' && event.path === addRetoPath:
            const addRetoBody = JSON.parse(event.body);
            response = await retosService.addReto(addRetoBody);
            break;
        case event.httpMethod === 'POST' && event.path === getRetosPath:
            const getRetosBody = JSON.parse(event.body);
            response = await retosService.getRetosByUserID(getRetosBody);
            break;
        case event.httpMethod === 'POST' && event.path === getRetosPersonalizadosPath:
            const getRetosPersonalizadosBody = JSON.parse(event.body);
            response = await retosService.getRetosPersonalizadosByUserID(getRetosPersonalizadosBody);
            break;
        case event.httpMethod === 'POST' && event.path === getRetosCompletadosPath:
            const getRetosCompletadosBody = JSON.parse(event.body);
            response = await retosService.getRetosCompletadosHoy(getRetosCompletadosBody);
            break;
        case event.httpMethod === 'POST' && event.path === addRecompensaPath:
            const addRecompensaBody = JSON.parse(event.body);
            response = await recompensasService.crearRecompensa(addRecompensaBody);
            break;
        case event.httpMethod === 'POST' && event.path === getRecompensasUserPath:
            const getRecompensasUserBody = JSON.parse(event.body);
            response = await recompensasService.getRecompensasByUserUuid(getRecompensasUserBody);
            break;
        case event.httpMethod === 'POST' && event.path === getRecompensaIdPath:
            const getRecompensaIdBody = JSON.parse(event.body);
            response = await recompensasService.getRecompensaByUuid(getRecompensaIdBody);
            break;
        case event.httpMethod === 'GET' && event.path === healthPath:
            response = util.buildResponse(200, 'Health');
            break;
        case event.httpMethod === 'POST' && event.path === registerPath:
            const registerBody = JSON.parse(event.body);
            response = await registerService.register(registerBody);
            break;
        case event.httpMethod === 'POST' && event.path === loginPath:
            const loginBody = JSON.parse(event.body);
            response = await loginService.login(loginBody);
            break;
        case event.httpMethod === 'POST' && event.path === verifyPath:
            const verifyBody = JSON.parse(event.body);
            response = await verifyService.verify(verifyBody);
            break;
        case event.httpMethod === 'POST' && event.path === addUserPath:
            const addUserBody = JSON.parse(event.body);
            response = await addUserService.addUsuario(addUserBody);
            break;
        case event.httpMethod === 'POST' && event.path === getUsuariosByCPath:
            const getUsuariosbyCBody = JSON.parse(event.body);
            response = await getUsuariosService.getUsuariosbyC(getUsuariosbyCBody);
            break;
        case event.httpMethod === 'POST' && event.path === getUsuariosByUUIDPath:
            const getUsuariosbyUUIDbody = JSON.parse(event.body);
            response = await getUsuariosService.getUsuarioByUUID(getUsuariosbyUUIDbody);
            break;
        case event.httpMethod === 'POST' && event.path === addActividadPath:
            const addActividadBody = JSON.parse(event.body);
            response = await actividadesService.addActividad(addActividadBody);
            break;
        case event.httpMethod === 'POST' && event.path === getActividadesByUserIDPath:
            const getActividadesUserIdBody = JSON.parse(event.body);
            response = await actividadesService.getActividadesByUserID(getActividadesUserIdBody);
            break;
        case event.httpMethod === 'POST' && event.path === getActividadesUserHoyPath:
            const getActividadesHoyBody = JSON.parse(event.body);
            response = await actividadesService.getActividadesByUserIDToday(getActividadesHoyBody);
            break;
        case event.httpMethod === 'POST' && event.path === getActividadesCompletadasUserHoyPath:
            const getActividadesCompletadasHoyBody = JSON.parse(event.body);
            response = await actividadesService.getActividadesCompletadasHoyInfo(getActividadesCompletadasHoyBody);
            break;
        case event.httpMethod === 'POST' && event.path === completarActividadPath:
            const completarActividadBody = JSON.parse(event.body);
            response = await actividadesService.completarActividad(completarActividadBody);
            break;
        case event.httpMethod === 'POST' && event.path === getActividadByIDPath:
            const getActividadIDBody = JSON.parse(event.body);
            response = await actividadesService.getActividadByID(getActividadIDBody);
            break;
        case event.httpMethod === 'POST' && event.path === deleteActividadPath:
            const deleteActividadBody = JSON.parse(event.body);
            response = await actividadesService.deleteActividad(deleteActividadBody);
            break;
        case event.httpMethod === 'POST' && event.path === vincularAlexaPath:
            const vincularAlexaBody = JSON.parse(event.body);
            response = await alexaService.vincularAlexa(vincularAlexaBody);
            break;
        default:
            response = util.buildResponse(404, '404 Not Found')
    }
    return response;

};

