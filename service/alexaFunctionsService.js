const AWS = require('aws-sdk');
AWS.config.update({
    region: 'eu-west-3'
});

const util = require('../utils/util')

const dynamodb = new AWS.DynamoDB.DocumentClient();

const userTable = 'UsersAvidir';
const actividadesTable = 'ActividadesAvidir';
const actividadesTableLogs = 'ActividadesAvidirLogs';

async function vincularAlexa(body) {
    const user_uuid = body.uuid;
    const email_alexa = body.emailAlexa;

    const params = {
        TableName: userTable,
        Key: {
            uuid: user_uuid
        },
        UpdateExpression: 'set email_alexa = :email',
        ExpressionAttributeValues: {
            ':email': email_alexa,
        }
    }

    const result = await dynamodb.update(params).promise().then(response => {
        console.log(response);
        return response;
    }, error => {
        console.error("Error al actualizar el usuario: ", error)
        return util.buildResponse(503, error);
    }
    )

    return util.buildResponse(200, result);
}

module.exports = {
    vincularAlexa
}