const AWS = require('aws-sdk');
AWS.config.update({
    region: 'eu-west-3'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const s3 = new AWS.S3();
const bucketName = 'avidir-files-bucket';

const { v4: uuidv4, v1: uuidv1 } = require('uuid')

const util = require('../utils/util')

const recompensasTable = 'RecompensasAvidir'

async function crearRecompensa(body) {

    const recompensa = {
        titulo: body.titulo,
        descripcion: body.descripcion,
        tipo: body.tipo,
        archivo: body.archivo,
        uuid_user: body.uuid_user,
        uuid_recompensa: uuidv4(),
        disponible: false
    }

    const params = {
        TableName: recompensasTable,
        Item: recompensa
    }

    const saveRecompensaResponse = await dynamodb.put(params).promise().then(response => {
        return true;
    }, error => {
        console.error('Hubo un error al añadir la recompensa: ', error)
        return false;
    })

    if (!saveRecompensaResponse)
        return util.buildResponse(503, { message: "Server Error. Inténtalo de nuevo más tarde" });

    return util.buildResponse(200, recompensa)
}

async function getRecompensasByUserUuid(body) {
    const uuid_user = body.uuid_user;

    const params = {
        ExpressionAttributeValues: {
            ':userUuidSearch': uuid_user
        },
        FilterExpression: 'uuid_user = :userUuidSearch',
        TableName: recompensasTable
    };

    const recompensas = await dynamodb.scan(params).promise().then(response => {
        return response.Items;
    }, error => {
        console.error("Error al obtener las recompensas para este usuario: ", error);
    })

    if (recompensas.length == 0) {
        return util.buildResponse(204, { message: "No hay recompensas disponibles" });
    }

    return util.buildResponse(200, recompensas);

}

async function getRecompensaByUuid(body) {
    const uuid = body.uuid_recompensa;

    const params = {
        Key: {
            uuid_recompensa: uuid
        },
        TableName: recompensasTable
    };

    const recompensa = await dynamodb.get(params).promise().then(response => {
        return response.Item;
    }, error => {
        console.error("Error al obtener las recompensas para este usuario: ", error);
    })

    if (!recompensa) {
        return util.buildResponse(204, { message: "No hay recompensas disponibles" });
    }

    return util.buildResponse(200, recompensa);

}

async function desbloquearRecompensa(user_uuid) {
    let desbloqueada = false;
    const uuid_user = user_uuid;

    const params = {
        ExpressionAttributeValues: {
            ':userUuidSearch': user_uuid,
            ':disponible': true
        },
        FilterExpression: 'uuid_user = :userUuidSearch AND disponible <> :disponible',
        TableName: recompensasTable
    };

    const recompensas = await dynamodb.scan(params).promise().then(response => {
        return response.Items;
    }, error => {
        console.error("Error al obtener las recompensas para este usuario: ", error);
    })

    if (recompensas.length > 0) {
        const paramsDesbloquear = {
            TableName: recompensasTable,
            Key: {
                uuid_recompensa: recompensas[0].uuid_recompensa
            },
            UpdateExpression: 'set disponible = :disponible',
            ExpressionAttributeValues: {
                ':disponible': true,
            }
        }

        desbloqueada = await dynamodb.update(paramsDesbloquear).promise().then(response => {
            return true;
        }, error => {
            console.error("Error al actualizar la recompensa: ", error)
        }
        )

    }

    return desbloqueada;

}

module.exports = {
    crearRecompensa,
    getRecompensasByUserUuid,
    getRecompensaByUuid,
    desbloquearRecompensa
}

