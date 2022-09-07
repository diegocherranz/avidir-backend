const AWS = require('aws-sdk');
AWS.config.update({
    region: 'eu-west-3'
});

const util = require('../utils/util')
const dynamodb = new AWS.DynamoDB.DocumentClient();
const userTable = 'UsersAvidir';

async function getUsuariosbyC(userInfo) {
    const email = userInfo.email;

    const listaUsuarios = await getUsuariosParams(email);
    if(listaUsuarios.length == 0){
        return util.buildResponse(204, { message: "No hay usuarios asociados" });
    }
    return util.buildResponse(200, listaUsuarios);




}

async function getUsuariosParams(emailCuidador) {

    const params = {
        ExpressionAttributeValues: {
          ':cuidador' : emailCuidador
        },
        FilterExpression: 'contains (cuidadores, :cuidador)',
        TableName: userTable
      };

    return await dynamodb.scan(params).promise().then(response => {
        console.log(response);
        return response.Items;
    }, error => {
        console.error("Error al obtener los usuarios: ", error)
    }
    )
}

async function getUsuarioByUUID(user) {
    const uuid = user.uuid;
    const listaUsuarios = await getUsuariobyUUIDParams(uuid);
    if(listaUsuarios.length == 0){
        return util.buildResponse(204, { message: "No hay usuarios asociados" });
    }
    return util.buildResponse(200, listaUsuarios);




}

async function getUsuariobyUUIDParams(uuid) {

    const params = {
        TableName: userTable,
        Key: {
            uuid: uuid
        }
    }

    return await dynamodb.get(params).promise().then(response => {
        console.log(response);
        return response.Item;
    }, error => {
        console.error("Error al obtener los usuarios: ", error)
    }
    )
}


module.exports = {
    getUsuariosbyC : getUsuariosbyC,
    getUsuarioByUUID : getUsuarioByUUID,
    getUsuariobyUUIDParams
}

//module.exports.getUsuariosbyC = getUsuariosbyC;
//module.exports.getUsuarioByUUID = getUsuarioByUUID;