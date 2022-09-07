const AWS = require('aws-sdk');
AWS.config.update({
    region: 'eu-west-3'
});

const { v4: uuidv4, v1: uuidv1 } = require('uuid')
const { batchWriteAll } = require("batch-write-all");

const util = require('../utils/util');
const { desbloquearRecompensa } = require('./recompensasService');

const dynamodb = new AWS.DynamoDB.DocumentClient();

const recompensasTable = 'RecompensasAvidir'
const retosTable = 'RetosAvidir'
const retosLogsTable = 'RetosAvidirLogs'
const actividadesTable = 'ActividadesAvidir'
const actividadesTableLogs = 'ActividadesAvidirLogs'
const notificacionesTable = 'NotificacionesAvidir';

async function addReto(body) {

    if (body.a_tiempo) {
        titulo = 'Completar actividad '
    }

    const reto = {
        titulo: body.titulo,
        act_titulo: body.act_titulo,
        uuid_act: body.uuid_act,
        tipo: body.tipo,
        uuid_user: body.uuid_user,
        uuid_reto: uuidv4(),
        a_tiempo: body.a_tiempo
    }

    const params = {
        TableName: retosTable,
        Item: reto
    }

    const saveRetoResponse = await dynamodb.put(params).promise().then(response => {
        return true;
    }, error => {
        console.error('Hubo un error al añadir el reto: ', error)
        return false;
    })

    if (!saveRetoResponse)
        return util.buildResponse(503, { message: "Server Error. Inténtalo de nuevo más tarde" });

    return util.buildResponse(200, reto)
}

async function getRetosPersonalizadosByUserID(body) {
    const uuid_user = body.uuid_user;

    const params = {
        ExpressionAttributeValues: {
            ':userUuidSearch': uuid_user
        },
        FilterExpression: 'uuid_user = :userUuidSearch',
        TableName: retosTable
    };

    const retos = await dynamodb.scan(params).promise().then(response => {
        return response.Items;
    }, error => {
        console.error("Error al obtener los retos para este usuario: ", error);
    })

    if (retos.length == 0) {
        return util.buildResponse(204, { message: "No hay retos disponibles" });
    }

    return util.buildResponse(200, retos);
}

async function getRetosByUserID(body) {
    const uuid_user = body.uuid_user;

    const params = {
        ExpressionAttributeValues: {
            ':userUuidSearch': uuid_user,
            ':tipo_diario': 'Diario',
            ':tipo_semanal': 'Semanal'
        },
        FilterExpression: 'uuid_user = :userUuidSearch OR tipo = :tipo_diario OR tipo = :tipo_semanal',
        TableName: retosTable
    };

    const retos = await dynamodb.scan(params).promise().then(response => {
        return response.Items;
    }, error => {
        console.error("Error al obtener los retos para este usuario: ", error);
    })

    if (retos.length == 0) {
        return util.buildResponse(204, { message: "No hay retos disponibles" });
    }

    return util.buildResponse(200, retos);
}

async function getRetosCompletadosHoy(body) {
    let date = new Date();
    let month_date = date.getMonth() + 1;
    if (month_date < 10) month_date = "0" + month_date;
    let day_date = date.getDate();
    if (day_date < 10) day_date = "0" + day_date;
    let date_hoy = `${date.getFullYear()}${month_date}${day_date}`;

    const paramsRetosCompletados = {
        ExpressionAttributeValues: {
            ':userUuidSearch': body.uuid_user,
            ':date_hoy': date_hoy
        },
        FilterExpression: 'uuid_user = :userUuidSearch AND date_hoy = :date_hoy',
        TableName: retosLogsTable
    }

    const retos_completados = await dynamodb.scan(paramsRetosCompletados).promise().then(response => {
        console.log("DEVOLVER A USUARIO RETOS COMPLETADOS: " + response.Items)
        return response.Items;
    }, error => {
        console.error("Error al obtener los retos completados para este usuario: ", error);
        return util.buildResponse(503, error);
    })

    return util.buildResponse(200, retos_completados);


}

async function comprobarRetosAlCompletarActividad(actividad, a_tiempo) {

    console.log("COMIENZA COMPROBAR RETOS")
    let date = new Date();
    let month_date = date.getMonth() + 1;
    if (month_date < 10) month_date = "0" + month_date;
    let day_date = date.getDate();
    if (day_date < 10) day_date = "0" + day_date;
    let date_hoy = `${date.getFullYear()}${month_date}${day_date}`;

    let notificacionesACrear = [];
    let retosACompletar = [];

    const paramsRetosCompletados = {
        ExpressionAttributeValues: {
            ':userUuidSearch': actividad.userUuid,
            ':date_hoy': date_hoy
        },
        FilterExpression: 'uuid_user = :userUuidSearch AND fecha = :date_hoy',
        TableName: retosLogsTable
    }

    const retos_completados_uuids = await dynamodb.scan(paramsRetosCompletados).promise().then(response => {
        if (response.Items.length > 0) {
            return response.Items.map(item => {
                return (
                    item.uuid_reto_uuid_user
                )
            })
        }

        return [];
    }, error => {
        console.error("Error al obtener los retos completados para este usuario: ", error);
    })

    console.log("RETOS COMPLETADOS UUIDS SON" + retos_completados_uuids)

    const paramsRetoAsociadoActividad = {
        ExpressionAttributeValues: {
            ':uuidActSearch': actividad.uuid
        },
        FilterExpression: 'uuid_act = :uuidActSearch',
        TableName: retosTable
    }

    const retoAsociadoActividad = await dynamodb.scan(paramsRetoAsociadoActividad).promise().then(response => {
        console.log("RETO ASOCIADO A LA ACTIVIDAD son: " + JSON.stringify(response.Items));
        if (response.Items.length > 0)
            return response.Items[0];
        else return null;
    }, error => {
        console.error("Error al obtener el reto asociado ", error);
    })

    if (retoAsociadoActividad) {
        if (!retos_completados_uuids.includes(retoAsociadoActividad.uuid_reto + retoAsociadoActividad.uuid_user) && ((retoAsociadoActividad.a_tiempo === a_tiempo && retoAsociadoActividad.a_tiempo === true) || retoAsociadoActividad.a_tiempo === false )) {
            console.log("SE CREA RETO COMPLETADO ASOCIADO A ACTIVIDAD")
            let desbloqueada = await desbloquearRecompensa(retoAsociadoActividad.uuid_user);
            let texto = `Has completado un reto, por lo que has desbloqueado una recompensa.`
            if (!desbloqueada) texto = `Has completado un reto, pero no se ha podido desbloquear ninguna recompensa.`
            let notificacion = {
                uuid_notificacion: retoAsociadoActividad.uuid_reto + date_hoy + retoAsociadoActividad.uuid_user,
                tipo: "Reto",
                uuid_user: retoAsociadoActividad.uuid_user,
                texto: texto,
                leida: false,
                fecha: date_hoy
            }

            notificacionesACrear.push(notificacion);
            let retoLog = {
                uuid_reto_uuid_user: retoAsociadoActividad.uuid_reto + retoAsociadoActividad.uuid_user,
                date_hoy: date_hoy,
                uuid_reto: retoAsociadoActividad.uuid_reto,
                uuid_user: retoAsociadoActividad.uuid_user
            }

            retosACompletar.push(retoLog);
        }
    }

    console.log("COMIENZA OBTENER ACTIVIDADES")

    //Comprobar retos diarios
    const userUuid = actividad.userUuid;

    //Obtener todas las actividades de hoy
    let date_begin = new Date();
    date_begin.setHours(0, 0, 0, 0);
    //comprobar si date end esta bien
    let date_end = new Date();
    date_end.setHours(0, 0, 0, 0);
    const today_begin = date_begin;
    const today_end = date_end;
    const today_weekday = util.getWeekdayChar(date_begin.getDay());

    console.log("FECHAS CREADAS ANTES DE OBTENER ACTIVIDADES")
    const paramsActividades = {
        ExpressionAttributeValues: {
            ':userUuidSearch': userUuid,
            ':semanalmente': "Semanalmente",
            ':unavez': "Una sola vez",
            ':diariamente': "Diariamente",
            ':todayBegin': today_begin.getTime(),
            ':todayEnd': today_end.getTime(),
            ':weekdayToday': today_weekday

        },
        FilterExpression: 'userUuid = :userUuidSearch AND (repeticionSelected = :unavez AND fechaUnaVez >= :todayBegin AND fechaUnaVez <= :todayEnd) OR (repeticionSelected = :diariamente) OR (repeticionSelected = :semanalmente AND contains(repeticionSemana, :weekdayToday))',
        TableName: actividadesTable
    };

    const actividadesHoy = await dynamodb.scan(paramsActividades).promise().then(response => {
        console.log("actividades hoyyyy " + response.Items)
        return response.Items;
    }, error => {
        console.error("Error al obtener las actividades para este usuario: ", error);
    })

    //Obtener las actividades completadas de hoy (Tabla de logs)

    console.log("COMIENZA OBTENER ACTIVIDADES COMPLETADAS")

    const paramsActividadesCompletadas = {
        ExpressionAttributeValues: {
            ':todayMidnight': date_begin.getTime(),
            ':uuidUserSearch': userUuid
        },
        ExpressionAttributeNames: { "#timestampMS": "timestampMS", '#uuidUser': "uuidUser" },
        FilterExpression: '#timestampMS >= :todayMidnight AND #uuidUser = :uuidUserSearch',
        TableName: actividadesTableLogs
    };


    const actividadesCompletadas = await dynamodb.scan(paramsActividadesCompletadas).promise().then(response => {
        return response.Items;
    }, error => {
        console.error("Error al obtener las actividades completadas para este usuario: ", error);
    })

    const actividadesCompletadasATiempo = actividadesCompletadas.filter(act => act.completadaATiempo)
    console.log("ACTIVIDADES COMPLETADAS A TIEMPO: " + actividadesCompletadasATiempo)

    if (!retos_completados_uuids.includes('TodasActividadesHoyATiempo' + userUuid) && actividadesHoy.length === actividadesCompletadasATiempo.length && actividadesCompletadasATiempo.length > 0) {
        let desbloqueada = await desbloquearRecompensa(userUuid);
        let texto = `Has completado un reto, por lo que has desbloqueado una recompensa.`
        if (!desbloqueada) texto = `Has completado un reto, pero no se ha podido desbloquear ninguna recompensa.`
        let notificacion = {
            uuid_notificacion: 'TodasActividadesHoyATiempo' + date_hoy + userUuid,
            tipo: "Reto",
            uuid_user: userUuid,
            texto: texto,
            leida: false,
            fecha: date_hoy
        }

        notificacionesACrear.push(notificacion);

        let retoLog = {
            uuid_reto_uuid_user: 'TodasActividadesHoyATiempo' + userUuid,
            date_hoy: date_hoy,
            uuid_reto: 'TodasActividadesHoyATiempo',
            uuid_user: userUuid
        }

        retosACompletar.push(retoLog);


    }

    if (notificacionesACrear.length > 0) {
        console.log("CREANDO NOTIFICACIONES")
        let items = notificacionesACrear.map(notif => ({
            PutRequest: {
                Item: notif
            }
        }));

        let params = {
            RequestItems: {
                [notificacionesTable]: items
            }
        };

        console.log("Notificaciones a crear: " + JSON.stringify(notificacionesACrear));
        batchWriteAll(dynamodb, params).promise()// <-- this is with using promise()
            .then(res => console.log('results  are', res))
            .catch(err => console.log('Error  are', err))
    }

    if (retosACompletar.length > 0) {
        console.log("CREANDO RETOS LOGS")
        let items = retosACompletar.map(reto => ({
            PutRequest: {
                Item: reto
            }
        }));

        let params = {
            RequestItems: {
                [retosLogsTable]: items
            }
        };

        console.log("Retos a ccompletar: " + JSON.stringify(retosACompletar));
        batchWriteAll(dynamodb, params).promise()// <-- this is with using promise()
            .then(res => console.log('results  are', res))
            .catch(err => console.log('Error  are', err))
    }

    //Send notificaciones al final
}

module.exports = {
    addReto,
    getRetosPersonalizadosByUserID,
    getRetosByUserID,
    getRetosCompletadosHoy,
    comprobarRetosAlCompletarActividad
}