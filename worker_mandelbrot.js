self.onmessage = function (event) {
    var data = event.data;
    var c_i = data.i;
    var bailout = data.escape * data.escape;
    var max_iter = data.max_iter;
    var r_c, c_z, i_z, tag;
    data.color_tag = [];

    for (var i = 0; i < data.width; i++) {
        r_c = data.r_min + (data.r_max - data.r_min) * i / data.width;
        c_z = 0, i_z = 0;
        for (iter = 0; c_z*c_z + i_z*i_z < bailout && iter < max_iter; iter++) {
            // z -> z^2 + c
            var tmp = c_z*c_z - i_z*i_z + r_c;
            i_z = 2 * c_z * i_z + c_i;
            c_z = tmp;
        }
        if (iter == max_iter) {
            tag = -1;
        } else {
            tag = iter;
            //tag = parseInt((iter-Math.log(Math.log(c_z*c_z + i_z*i_z)/Math.log(bailout))/Math.log(2)) * 1) % max_iter;
        }
        data.color_tag.push(tag);
    }
    self.postMessage(data);
}
