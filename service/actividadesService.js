const AWS = require('aws-sdk');
AWS.config.update({
    region: 'eu-west-3'
});

const util = require('../utils/util')
const notificacionesService = require('./notificacionesService')
const bcrypt = require('bcryptjs')
const { v4: uuidv4, v1: uuidv1 } = require('uuid');
const { comprobarRetosAlCompletarActividad } = require('./retosService');

const dynamodb = new AWS.DynamoDB.DocumentClient();
const actividadesTable = 'ActividadesAvidir';
const actividadesTableLogs = 'ActividadesAvidirLogs';

function horaStringMasMinutos(horaString, minutos) {
    let horaSplit = horaString.split(":");
    let h_a_min = parseInt(horaSplit[0]) * 60;
    let min_total = h_a_min + parseInt(horaSplit[1]) + parseInt(minutos);
    let min = min_total % 60;
    let hora = Math.floor(min_total / 60);

    return `${hora}:${min}`;
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


async function addActividad(taskInfo) {
    const uuid = uuidv4();
    const { userid, titulo, descripcion, hora, tiempo_completar, repeticionSelected, tipoSelected, fechaUnaVez, repeticionSemana,
        notifUserInicio, notifUserTerminar, notifUserTerminarTiempo, notifUserNoTerminar, notifCCompletar, notifCNoCompletar, notifCNoCompletarTiempo, cuidadores_uuid } = taskInfo;

    function getTimeIfNotNull(fecha){
        if(fecha) return new Date(fechaUnaVez).getTime()

        return '';
    }

        
    const actividad = {
        uuid: uuid,
        userUuid: userid,
        titulo: titulo,
        descripcion: descripcion,
        hora: hora,
        tiempo_completar: tiempo_completar,
        repeticionSelected: repeticionSelected,
        fechaUnaVez: getTimeIfNotNull(fechaUnaVez),
        repeticionSemana: repeticionSemana,
        tipoSelected: tipoSelected,
        notifUserInicio: notifUserInicio,
        notifUserTerminar: notifUserTerminar,
        notifUserTerminarTiempo: notifUserTerminarTiempo,
        notifUserNoTerminar: notifUserNoTerminar,
        notifCCompletar: notifCCompletar,
        notifCNoCompletar: notifCNoCompletar,
        notifCNoCompletarTiempo: notifCNoCompletarTiempo,
        cuidadores_uuid: cuidadores_uuid

    }

    console.log(actividad);

    const saveActividadResponse = await saveActividad(actividad);
    if (!saveActividadResponse) {
        return util.buildResponse(503, { message: "Server Error. Inténtalo de nuevo más tarde" });
    }
    console.log('Actividad creada');
    return util.buildResponse(200, { uuid: uuid })

}

async function saveActividad(actividad) {
    const params = {
        TableName: actividadesTable,
        Item: actividad
    }

    return await dynamodb.put(params).promise().then(() => {
        return true;
    }), error => {
        console.error('Hubo un error al añadir la actividad: ', error)
    }
}


async function getActividadesByUserID(userInfo) {
    const userUuid = userInfo.uuid;

    const params = {
        ExpressionAttributeValues: {
            ':userUuidSearch': userUuid
        },
        FilterExpression: 'userUuid = :userUuidSearch',
        TableName: actividadesTable
    };

    const actividades = await dynamodb.scan(params).promise().then(response => {
        return response.Items;
    }, error => {
        console.error("Error al obtener las actividades para este usuario: ", error);
    })

    if (actividades.length == 0) {
        return util.buildResponse(204, { message: "No hay actividades" });
    }

    return util.buildResponse(200, actividades);
}

async function getActividadesByUserIDToday(userInfo) {
    const userUuid = userInfo.uuid;

    let date_begin = new Date();
    date_begin.setHours(0, 0, 0, 0);
    let date_end = new Date();
    date_end.setHours(0, 0, 0, 0);
    const today_begin = date_begin;
    const today_end = date_end;
    const today_weekday = util.getWeekdayChar(date_begin.getDay());

    const params = {
        ExpressionAttributeValues: {
            ':userUuidSearch': userUuid,
            ':semanalmente': "Semanalmente",
            ':unavez': "Una sola vez",
            ':diariamente': "Diariamente",
            ':todayBegin': today_begin.getTime(),
            ':todayEnd': today_end.getTime(),
            ':weekdayToday': today_weekday

        },
        FilterExpression: 'userUuid = :userUuidSearch AND ((repeticionSelected = :unavez AND fechaUnaVez >= :todayBegin AND fechaUnaVez <= :todayEnd) OR (repeticionSelected = :diariamente) OR (repeticionSelected = :semanalmente AND contains(repeticionSemana, :weekdayToday)))',
        TableName: actividadesTable
    };

    const actividadesShow = await dynamodb.scan(params).promise().then(response => {
        console.log(response.Items)
        return response.Items;
    }, error => {
        console.error("Error al obtener las actividades para este usuario: ", error);
    })

    const actividadesCompletadas = await getActividadesCompletadasHoy(userInfo);

    let arrayActividades = [];

    if (!actividadesCompletadas) {
        arrayActividades = actividadesShow;
    }
    else {

        actividadesShow.forEach(act => {
            if (!actividadesCompletadas.includes(act.uuid)) {
                arrayActividades.push(act);
            }
        })
    }

    return util.buildResponse(200, arrayActividades);

}

const unique = (value, index, self) => {
    return self.indexOf(value) === index
}

async function getActividadesCompletadasHoy(userInfo) {
    const userUuid = userInfo.uuid;
    let date = new Date();
    date.setHours(0, 0, 0, 0);


    const params = {
        ExpressionAttributeValues: {
            ':todayMidnight': date.getTime(),
            ':uuidUserSearch': userUuid
        },
        ExpressionAttributeNames: { "#timestampMS": "timestampMS", '#uuidUser': "uuidUser" },
        FilterExpression: '#timestampMS >= :todayMidnight AND #uuidUser = :uuidUserSearch',
        TableName: actividadesTableLogs
    };


    const actividades = await dynamodb.scan(params).promise().then(response => {

        return response.Items;
    }, error => {
        console.error("Error al obtener las actividades para este usuario: ", error);
    })

    let uuidActArray = actividades.map(function (item, i) {
        return item.uuidActividad;
    });

    let uuidActArrayUnique = uuidActArray.filter(unique);

    if (uuidActArrayUnique.length == 0) {
        return null;
    }

    return uuidActArrayUnique;
}

async function getActividadesCompletadasHoyInfo(userInfo){
    const actividadesCompletadas = await getActividadesCompletadasHoy(userInfo);

    if(!actividadesCompletadas)
        return util.buildResponse(204, { message: "No hay actividades completadas hoy" });

        return util.buildResponse(200, actividadesCompletadas);
}

async function completarActividad(actividad) {
    const taskUuid = actividad.uuid;
    const userUuid = actividad.userUuid;

    let hora_max = horaStringMasMinutos(actividad.hora, actividad.tiempo_completar);

    let date = new Date();
    const timestamp = date.toJSON();
    const timestampMS = date.getTime();
    let hora_actual = horaStringMasMinutos(`${date.getHours()}:${date.getMinutes()}`,120);
    
    let completadaATiempo = timeLessThan(hora_actual,hora_max);
    console.log(`Completar actividad a tiempo?? ${hora_actual} < ${hora_max} ?`)

    const taskCompleted = {
        idTimestamp: timestamp,
        uuidActividad: taskUuid,
        uuidUser: userUuid,
        timestampMS: timestampMS,
        completadaATiempo: completadaATiempo
    }

    const params = {
        TableName: actividadesTableLogs,
        Item: taskCompleted
    }

    const actividadCompletada = await dynamodb.put(params).promise().then(() => {
        return true;
    }, error => {
        console.error('Hubo un error al completar la actividad: ', error)
    });

    if (!actividadCompletada) {
        return util.buildResponse(503, { message: "Server Error. Inténtalo de nuevo más tarde" });
    }

    await notificacionesService.crearNotificacionAlCompletarActividad(actividad);
    await comprobarRetosAlCompletarActividad(actividad,completadaATiempo);

    return util.buildResponse(200, taskCompleted);

}

async function getActividadByID(body) {
    const actividad_uuid = body.uuid;
    const user_uuid = body.userUuid;

    const params = {
        TableName: actividadesTable,
        Key: {
            uuid: actividad_uuid,
            userUuid: user_uuid
        }
    }


    const actividad = await dynamodb.get(params).promise().then(response => {
        return response.Item;
    }, error => {
        console.error("Error al obtener la actividad: ", error)
    }
    )

    if (actividad.length == 0) {
        return util.buildResponse(204, { message: "No existe la actividad" });
    }

    return util.buildResponse(200, actividad);

}

async function deleteActividad(body){
    const actividad_uuid = body.uuid;
    const user_uuid = body.userUuid;
    let message = '';

    const params = {
        TableName: actividadesTable,
        Key: {
            uuid: actividad_uuid,
            userUuid: user_uuid
        }
    }

    const result = await dynamodb.delete(params).promise().then(response => {
        message = "Actividad borrada";
        console.log(response);
        return response;
    }, error => {
        console.error("Error al borrar la actividad: ", error)
        return util.buildResponse(503, error);
    }
    )

    return util.buildResponse(200, result);


}


module.exports = { addActividad, getActividadesByUserID, completarActividad, getActividadesByUserIDToday,getActividadesCompletadasHoyInfo, getActividadByID, deleteActividad };