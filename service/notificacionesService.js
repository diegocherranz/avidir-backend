const AWS = require('aws-sdk');
AWS.config.update({
    region: 'eu-west-3'
});

const util = require('../utils/util')
const bcrypt = require('bcryptjs')
const { batchWriteAll } = require("batch-write-all");
const { v4: uuidv4, v1: uuidv1 } = require('uuid')
const getUsuariosService = require('./getUsuarios');

const dynamodb = new AWS.DynamoDB.DocumentClient();
const actividadesTable = 'ActividadesAvidir';
const actividadesTableLogs = 'ActividadesAvidirLogs';
const notificacionesTable = 'NotificacionesAvidir';

async function getTodasActividadesHoy() {

    let date_begin = new Date();
    date_begin.setHours(0, 0, 0, 0);
    let date_end = new Date();
    date_end.setHours(0, 0, 0, 0);
    const today_begin = date_begin;
    const today_end = date_end;
    const today_weekday = util.getWeekdayChar(date_begin.getDay());

    const params = {
        ExpressionAttributeValues: {
            ':semanalmente': "Semanalmente",
            ':unavez': "Una sola vez",
            ':diariamente': "Diariamente",
            ':todayBegin': today_begin.getTime(),
            ':todayEnd': today_end.getTime(),
            ':weekdayToday': today_weekday

        },
        FilterExpression: '(repeticionSelected = :unavez AND fechaUnaVez >= :todayBegin AND fechaUnaVez <= :todayEnd) OR (repeticionSelected = :diariamente) OR (repeticionSelected = :semanalmente AND contains(repeticionSemana, :weekdayToday))',
        TableName: actividadesTable
    };

    const actividadesShow = await dynamodb.scan(params).promise().then(response => {
        return response.Items;
    }, error => {
        console.error("Error al obtener las actividades de hoy: ", error);
    })

    return actividadesShow;
}

async function getActividadesHoyCompletadas() {
    let date = new Date();
    date.setHours(0, 0, 0, 0);


    const params = {
        ExpressionAttributeValues: {
            ':todayMidnight': date.getTime()
        },
        ExpressionAttributeNames: { "#timestampMS": "timestampMS" },
        FilterExpression: '#timestampMS >= :todayMidnight',
        TableName: actividadesTableLogs
    };

    const actividades = await dynamodb.scan(params).promise().then(response => {
        console.log("Actividades completadas son: " + JSON.stringify(response.Items));
        return response.Items;
    }, error => {
        console.error("Error al obtener las actividades completadas: ", error);
    })

    return actividades;
}

function timeLessThan(time1, time2) {
    let time1S = time1.split(":");
    let time2S = time2.split(":");

    console.log(parseInt(time1S[0]) + "< " + parseInt(time2S[0]));
    console.log(parseInt(time1S[1]) + "< " + parseInt(time2S[1]));

    if (parseInt(time1S[0]) < parseInt(time2S[0])) {
        return true;
    }
    else if ((parseInt(time1S[0]) == parseInt(time2S[0])) && (parseInt(time1S[1]) < parseInt(time2S[1]))) {
        return true;
    }
    else return false;
}

async function getActividadesHoyPendientes() {

    const actividades_hoy = await getTodasActividadesHoy();
    const actividades_completadas = await getActividadesHoyCompletadas();
    let date = new Date();
    let time_string_now = `${(date.getHours() + 2) % 24}:${date.getMinutes()}`;


    let completadas_ids = actividades_completadas.map(act => {
        return act.uuidActividad;
    })

    console.log("Actividades completadas hoy: " + JSON.stringify(actividades_completadas))

    let actividades_pendientes = [];

    actividades_hoy.map(act => {

        console.log(act.titulo + " " + act.hora + "< " + time_string_now + " " + timeLessThan(act.hora, time_string_now));
        if (!completadas_ids.includes(act.uuid) && timeLessThan(act.hora, time_string_now))
            actividades_pendientes.push(act);
    })

    console.log(JSON.stringify(actividades_pendientes));

    return actividades_pendientes;
}

async function getAllNotificacionesUUIDsHoy() {
    let date = new Date();
    let month_date = date.getMonth() + 1;
    if (month_date < 10) month_date = "0" + month_date;
    let day_date = date.getDate();
    if (day_date < 10) day_date = "0" + day_date;
    let date_hoy = `${date.getFullYear()}${month_date}${day_date}`;

    const params = {
        ExpressionAttributeValues: {
            ':fecha_comparar': date_hoy
        },
        ExpressionAttributeNames: { "#fecha": "fecha" },
        FilterExpression: '#fecha = :fecha_comparar',
        TableName: notificacionesTable
    };

    const notificaciones = await dynamodb.scan(params).promise().then(response => {
        console.log("Notificaciones de hoy son: " + JSON.stringify(response.Items));
        if (response.Items.length > 0)
            return response.Items;
        else return [];
    }, error => {
        console.error("Error al obtener las notificaciones: ", error);
    })

    let notificaciones_uuids = [];

    notificaciones.map(notif => {
        notificaciones_uuids.push(notif.uuid_notificacion);
    })

    console.log("Notificaciones uuids: " + notificaciones_uuids)

    return notificaciones_uuids;


}

function horaStringMasMinutos(horaString, minutos) {
    let horaSplit = horaString.split(":");
    let h_a_min = parseInt(horaSplit[0]) * 60;
    let min_total = h_a_min + parseInt(horaSplit[1]) + parseInt(minutos);
    let min = min_total % 60;
    let hora = Math.floor(min_total / 60);

    return `${hora}:${min}`;
}

async function crearNotificaciones() {
    let date = new Date();
    let time_string_now = `${(date.getHours() + 2) % 24}:${date.getMinutes()}`;
    let month_date = date.getMonth() + 1;
    if (month_date < 10) month_date = "0" + month_date;
    let day_date = date.getDate();
    if (day_date < 10) day_date = "0" + day_date;
    let date_hoy = `${date.getFullYear()}${month_date}${day_date}`;


    const actividades_pendientes = await getActividadesHoyPendientes();
    const notificacionesHoy = await getAllNotificacionesUUIDsHoy();

    let notificaciones = []

    actividades_pendientes.map(act => {

        //Notificación al empezar
        if (timeLessThan(act.hora, time_string_now) && act.notifUserInicio && !notificacionesHoy.includes(act.uuid + date_hoy + "UInicio")) {
            let notif = {
                uuid_notificacion: act.uuid + date_hoy + "UInicio",
                tipo: "UInicio",
                uuid_actividad: act.uuid,
                uuid_user: act.userUuid,
                texto: `Ya puedes comenzar la actividad ${act.titulo}, deberías completarla en menos de ${act.tiempo_completar} minutos.`,
                leida: false,
                fecha: date_hoy
            }
            notificaciones.push(notif);
        }

        //Notificacion antes de terminar hora+(tiempo_completar-notifUserTerminarTiempo)
        //let tiempoAntesTerminar = act.tiempo_completar
        let hora_antesterminar = horaStringMasMinutos(act.hora, parseInt(act.tiempo_completar) - parseInt(act.notifUserTerminarTiempo));
        //console.log("hora antes de terminar notificacion " + hora_antesterminar)
        if (timeLessThan(hora_antesterminar, time_string_now) && act.notifUserTerminar && !notificacionesHoy.includes(act.uuid + date_hoy + "UATerminar")) {
            let notif = {
                uuid_notificacion: act.uuid + date_hoy + "UATerminar",
                tipo: "UATerminar",
                uuid_actividad: act.uuid,
                uuid_user: act.userUuid,
                texto: `Quedan ${act.notifUserTerminarTiempo} minutos para terminar la actividad ${act.titulo} a tiempo.`,
                leida: false,
                fecha: date_hoy
            }
            notificaciones.push(notif);
        }

        //Notificacion no completada a tiempo hora+tiempo_terminar
        let hora_nocompletada = horaStringMasMinutos(act.hora, act.tiempo_completar);
        if (timeLessThan(hora_nocompletada, time_string_now) && act.notifUserNoTerminar && !notificacionesHoy.includes(act.uuid + date_hoy + "UNoCompletada")) {
            let notif = {
                uuid_notificacion: act.uuid + date_hoy + "UNoCompletada",
                tipo: "UNoCompletada",
                uuid_actividad: act.uuid,
                uuid_user: act.userUuid,
                texto: `No has completado la actividad ${act.titulo} en el tiempo adecuado, pero ¡aún puedes completarla!`,
                leida: false,
                fecha: date_hoy
            }
            notificaciones.push(notif);
        }

        //Notificacion no completada a tiempo para cuidador hora+notifCNoCompletarTiempo notifCNoCompletarTiempo

        //console.log(act)
        let hora_cnocompletada = horaStringMasMinutos(act.hora, act.notifCNoCompletarTiempo);
        act.cuidadores_uuid.map(cuidador => {
            if (timeLessThan(hora_cnocompletada, time_string_now) && act.notifCNoCompletar && !notificacionesHoy.includes(act.uuid + date_hoy + cuidador + "CNoCompletada")) {

                let notif = {
                    uuid_notificacion: act.uuid + date_hoy + cuidador + "CNoCompletada",
                    tipo: "CNoCompletada",
                    uuid_actividad: act.uuid,
                    uuid_user: cuidador,
                    texto: `El usuario ${act.userUuid} aún no ha completado la actividad ${act.titulo} tras ${act.notifCNoCompletarTiempo} minutos`,
                    leida: false,
                    fecha: date_hoy,
                    uuid_usuarioACargo: act.userUuid
                }

                notificaciones.push(notif);
            }
        })






    })


    let items = notificaciones.map(notif => ({
        PutRequest: {
            Item: notif
        }
    }));

    let params = {
        RequestItems: {
            [notificacionesTable]: items
        }
    };

    //console.log("Notificaciones a crear: " + JSON.stringify(notificaciones));
    batchWriteAll(dynamodb, params).promise()// <-- this is with using promise()
        .then(res => console.log('results  are', res))
        .catch(err => console.log('Error  are', err))
}

async function crearNotificacionAlCompletarActividad(act) {
    let notificaciones = [];
    const notificacionesHoy = await getAllNotificacionesUUIDsHoy();
    let date = new Date();
    let time_string_now = `${(date.getHours() + 2) % 24}:${date.getMinutes()}`;
    let month_date = date.getMonth() + 1;
    if (month_date < 10) month_date = "0" + month_date;
    let day_date = date.getDate();
    if (day_date < 10) day_date = "0" + day_date;
    let date_hoy = `${date.getFullYear()}${month_date}${day_date}`;
    act.cuidadores_uuid.map(cuidador => {
        if (act.notifCCompletar && !notificacionesHoy.includes(act.uuid + date_hoy + cuidador + "CCompletada")) {

            let notif = {
                uuid_notificacion: act.uuid + date_hoy + cuidador + "CCompletada",
                tipo: "CCompletada",
                uuid_actividad: act.uuid,
                uuid_user: cuidador,
                texto: `El usuario ${act.userUuid} ha completado la actividad ${act.titulo}`,
                leida: false,
                fecha: date_hoy,
                uuid_usuarioACargo: act.userUuid
            }

            notificaciones.push(notif);
        }
    })

    let items = notificaciones.map(notif => ({
        PutRequest: {
            Item: notif
        }
    }));

    let params = {
        RequestItems: {
            [notificacionesTable]: items
        }
    };

    //console.log("Notificaciones al completar a crear: " + JSON.stringify(notificaciones));
    batchWriteAll(dynamodb, params).promise()// <-- this is with using promise()
        .then(res => console.log('results  are', res))
        .catch(err => console.log('Error  are', err))
}

async function getNotificacionesByUserIDHoy(body){
    const user_uuid = body.user_uuid;
    let date = new Date();
    let month_date = date.getMonth() + 1;
    if (month_date < 10) month_date = "0" + month_date;
    let day_date = date.getDate();
    if (day_date < 10) day_date = "0" + day_date;
    let date_hoy = `${date.getFullYear()}${month_date}${day_date}`;

    const params = {
        ExpressionAttributeValues: {
            ':fecha_comparar': date_hoy,
            ':user_uuid': user_uuid,
            ':leida': false
        },
        ExpressionAttributeNames: { "#fecha": "fecha", '#uuid_user': "uuid_user", '#leida':'leida' },
        FilterExpression: '#fecha = :fecha_comparar AND #uuid_user = :user_uuid AND #leida = :leida',
        TableName: notificacionesTable
    };

    const notificaciones = await dynamodb.scan(params).promise().then(response => {
        console.log("Notificaciones del usuario son: " + JSON.stringify(response.Items));
        if (response.Items.length > 0)
            return response.Items;
        else return [];
    }, error => {
        console.error("Error al obtener las notificaciones: ", error);
    })

    if (notificaciones.length == 0) {
        return util.buildResponse(204, { message: "No hay notificaciones" });
    }

    return util.buildResponse(200, notificaciones);

}

async function marcarNotificacionLeida(body) {
    const uuid_notificacion = body.uuid_notificacion;

    const params = {
        TableName: notificacionesTable,
        Key: {
            uuid_notificacion: uuid_notificacion
        },
        UpdateExpression: 'set leida = :leida',
        ExpressionAttributeValues: {
            ':leida': true,
        }
    }

    const result = await dynamodb.update(params).promise().then(response => {
        console.log(response);
        return response;
    }, error => {
        console.error("Error al actualizar la notificación: ", error)
        return util.buildResponse(503, error);
    }
    )

    return util.buildResponse(200, result);
}

module.exports = { getActividadesHoyPendientes, crearNotificaciones, crearNotificacionAlCompletarActividad, getNotificacionesByUserIDHoy, marcarNotificacionLeida }