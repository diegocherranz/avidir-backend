function buildResponse(statusCode, body) {
    return {
        'statusCode': statusCode,
        'headers': {
            "Access-Control-Allow-Headers" : "Content-Type",
            "Access-Control-Allow-Origin": '*',
            "Access-Control-Allow-Methods": "OPTIONS,POST,GET",
            "Access-Control-Allow-Credentials" : true,
            "Content-Type": 'application/json'
        },
        'body': JSON.stringify(body)
    }
}

function getWeekdayChar(weekday) {
    let weekdayChar = null;

    switch (weekday) {
        case 0:
            weekdayChar = "D";
            break;
        case 1:
            weekdayChar = "L";
            break;
        case 2:
            weekdayChar = "M";
            break;
        case 3:
            weekdayChar = "X";
            break;
        case 4:
            weekdayChar = "J";
            break;
        case 5:
            weekdayChar = "V";
            break;
        case 6:
            weekdayChar = "S";
            break;
        default:
            break;
    }

    return weekdayChar;
}

module.exports = {buildResponse, getWeekdayChar};