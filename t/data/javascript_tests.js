function test1() {
    var str = 'a=1&b=2&c=3&c=4&d=5&d=6&d=7&e';
    var obj = toQueryParams(str);
    if(str != toQueryString(obj)) {
        diag("failed: " + str + " != " + toQueryString(obj));
        return 0;
    }
    return 1;
}

function test1a() {
    var str = 'a=1&b=&c=3&c=4&d=5&d=6&d=7&e';
    var obj = toQueryParams(str);
    if(str != toQueryString(obj)) {
        diag("failed: " + str + " != " + toQueryString(obj));
        return 0;
    }
    return 1;
}
