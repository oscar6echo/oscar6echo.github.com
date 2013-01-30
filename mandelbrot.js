var Mandelbrot = function (canvas) {
    var self = this;
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.row_data = this.ctx.createImageData(canvas.width, 1);

    this.r_max = 1.5;
    this.r_min = -2.5;
    this.i_max = 1.5;
    this.i_min = -1.5;
    this.max_iter = 1024;
    this.escape = 100;
    this.generation = 0;
    this.zoom_flag = 1;
    this.zoom_factor = 1;
    this.red_freq = 7;
    this.green_freq = 5;
    this.blue_freq = 11;

    this.nb_workers = 20;

    this.center_row = Math.round(window.innerHeight/2);
    this.next_row_up = this.center_row - 1;
    this.next_row_down = this.center_row;
    
    this.canvas.addEventListener("click", function(event) {
        if (event.shiftKey) {
            //console.log("shift pressed ->> zoom out");
            self.zoom_flag = -1;
        } else {
            //console.log("no shift pressed ->> zoom in");
            self.zoom_flag = 1;
        };
        self.click_update(event.clientX + document.body.scrollLeft +
                   document.documentElement.scrollLeft - canvas.offsetLeft,
                   event.clientY + document.body.scrollTop +
                   document.documentElement.scrollTop - canvas.offsetTop);
    }, false);

    window.addEventListener("keydown", function(event) {
        //alert("event.keyCode="+event.keyCode);
        var height = self.i_max - self.i_min;
        var width = self.r_max - self.r_min;
        var shift = 1/3;
        //console.log("event.keyCode="+event.keyCode);

        
        if (event.keyCode == 100) {  // left -> 4 on keypad
            self.r_min = self.r_min - width * shift;
            self.r_max = self.r_max - width * shift;
        };
        if (event.keyCode == 104) {  // up -> 8 on keypad
            self.i_min = self.i_min + height * shift;
            self.i_max = self.i_max + height * shift;
        };
        if (event.keyCode == 102) {  // right -> 6 on keypad
            self.r_min = self.r_min + width * shift;
            self.r_max = self.r_max + width * shift;
        };
        if (event.keyCode == 98) {  // down -> 2 on keypad
            self.i_min = self.i_min - height * shift;
            self.i_max = self.i_max - height * shift;
        };
            
        self.update_form();  
        self.center_row = Math.round(window.innerHeight/2);
        self.redraw();
    }, false);

    window.addEventListener("resize", function(event) {
        self.resize_to_parent();
    }, false);

    this.workers = [];
    for (var i = 0; i < this.nb_workers; i++) {
        var worker = new Worker("worker_mandelbrot.js");
        worker.onmessage = function(event) {
            self.received_row(event.target, event.data)
        }
        worker.idle = true;
        this.workers.push(worker);
    }

    this.make_palette()
}

Mandelbrot.prototype = {
    make_palette: function() {
        this.palette = [];
        function wrap(x) {
            var remainder = x % 255;
            var quotient = ( x - remainder ) / 255;
            if (quotient % 2 != 0) remainder = 255 - remainder;
            return remainder;
        }
        /*for (i = 0; i <= this.max_iter; i++) {
            console.log("wrap("+i+")="+wrap(i));
        }*/
        for (i = 0; i <= this.max_iter; i++) {
            //this.palette.push([wrap(7*i), wrap(5*i), wrap(11*i)]);
            this.palette.push([wrap(this.red_freq*i), wrap(this.green_freq*i), wrap(this.blue_freq*i)]);
        }
        /*for (i = 0; i <= this.max_iter; i++) {
            console.log("this.palette["+i+"]="+this.palette[i]);
        }*/
    },

    draw_row: function(data) {
        var color_tag = data.color_tag;
        /*for (i = 0; i <= this.max_iter; i++) {
            console.log("color_tag("+i+")="+color_tag[i]);
        }*/
        var pdata = this.row_data.data;
        for (var i = 0; i < this.row_data.width; i++) {
            pdata[4*i+3] = 255;
            if (color_tag[i] == -1) {
                pdata[4*i] = 0;
                pdata[4*i+1] = 0;
                pdata[4*i+2] = 0;
            } else {
                //console.log("color_tag["+i+"]="+color_tag[i]);
                var colour = this.palette[color_tag[i]];
                pdata[4*i] = colour[0];
                pdata[4*i+1] = colour[1];
                pdata[4*i+2] = colour[2];
            }
        }
        this.ctx.putImageData(this.row_data, 0, data.row);
    },

    process_row: function(worker, n) {
        var row;
        if (n % 2 == 0){
            row = this.next_row_down;
            this.next_row_down++;
        } else {
            row = this.next_row_up;
            this.next_row_up--;
        }
        if (row >= this.canvas.height || row < 0) {
            worker.idle = true;
        } else {
            worker.idle = false;
            worker.postMessage({
                n: n,
                row: row,
                width: this.row_data.width,
                generation: this.generation,
                r_min: this.r_min,
                r_max: this.r_max,
                i: this.i_max + (this.i_min - this.i_max) * row / this.canvas.height,
                max_iter: this.max_iter,
                escape: this.escape,
           })
        }
    },

    received_row: function (worker, data) {
        if (data.generation == this.generation) {
            this.draw_row(data);
        }
        this.process_row(worker, data.n);
    },

    redraw: function() {
        this.generation++;
        this.next_row_up = this.center_row - 1;
        this.next_row_down = this.center_row;
        for (var i = 0; i < this.workers.length; i++) {
            var worker = this.workers[i];
            if (worker.idle)
                this.process_row(worker, i);
        }
    },

    reset_workers: function(nb_workers) {
        var self = this;
        if (nb_workers - this.nb_workers > 0){
            for (var i = this.nb_workers; i < nb_workers; i++) {
                var worker = new Worker("worker_test.js");
                worker.onmessage = function(event) {
                    self.received_row(event.target, event.data)
                }
                worker.idle = true;
                this.workers.push(worker);
            }
        } else {
            for (var i = this.nb_workers - 1; i >= nb_workers; i--) {
                var worker = this.workers[i];
                this.workers.pop();
                worker.terminate();
            }
        }
        this.nb_workers = nb_workers;
    },

    resize_to_parent: function() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;

        // Adjust the horizontal scale to maintain aspect ratio
        var height = this.i_max - this.i_min;
        var width = height * (this.canvas.width / this.canvas.height);
        var r_center = (this.r_max + this.r_min) / 2;
        this.r_min = r_center - width/2;
        this.r_max = r_center + width/2;
        
        this.update_form();  
        this.row_data = this.ctx.createImageData(this.canvas.width, 1);
        this.center_row = Math.round(window.innerHeight/2);
        this.redraw();
    },

    form_submit: function() {
        var red_freq = parseFloat(document.getElementById("coord").elements["red_freq"].value);
        var green_freq = parseFloat(document.getElementById("coord").elements["green_freq"].value);
        var blue_freq = parseFloat(document.getElementById("coord").elements["blue_freq"].value);
        var max_iter = parseFloat(document.getElementById("coord").elements["max_iter"].value);
        if (red_freq != this.red_freq || green_freq != this.green_freq || blue_freq != this.blue_freq || max_iter != this.max_iter) {
            this.red_freq = red_freq;
            this.green_freq = green_freq;
            this.blue_freq = blue_freq;
            this.max_iter = max_iter
            this.make_palette();
        }

        var nb_workers = parseInt(document.getElementById("coord").elements["nb_workers"].value);
        if (nb_workers != this.nb_workers) {
            this.reset_workers(nb_workers);
        }
        
        this.zoom_factor = parseFloat(document.getElementById("coord").elements["zoom_factor"].value);
        this.escape = parseFloat(document.getElementById("coord").elements["escape"].value);

        var r_center = parseFloat(document.getElementById("coord").elements["r_center"].value);
        var i_center = parseFloat(document.getElementById("coord").elements["i_center"].value);
        var zoom = parseFloat(document.getElementById("coord").elements["zoom"].value);
        var height = 3.0/zoom;
        var width =  height * (this.canvas.width / this.canvas.height);
        this.r_max = r_center + width/2;
        this.r_min = r_center - width/2;
        this.i_max = i_center + height/2;
        this.i_min = i_center - height/2;
        
        this.update_form();
        this.center_row = Math.round(window.innerHeight/2);
        this.redraw()
    },

    click_update: function(x, y) {
        var width = this.r_max - this.r_min;
        var height = this.i_max - this.i_min;
        var r_click = this.r_min + width * x / this.canvas.width;
        var i_click = this.i_max - height * y / this.canvas.height;
        var zoom = parseFloat(document.getElementById("coord").elements["zoom"].value);
        var zoom_factor = parseFloat(document.getElementById("coord").elements["zoom_factor"].value);

        if (this.zoom_flag === 1) {
            zoom = zoom * zoom_factor;
        } else {
            zoom = zoom / zoom_factor;
        };
        var height = 3.0/zoom;
        var width =  height * (this.canvas.width / this.canvas.height);
        this.r_min = r_click - width/2;
        this.r_max = r_click + width/2;
        this.i_max = i_click + height/2;
        this.i_min = i_click - height/2;
        
        this.update_form();
        this.center_row = y;
        this.redraw()
    },

    update_form: function(){
        document.getElementById("coord").elements["r_center"].value = (this.r_max + this.r_min)/2;
        document.getElementById("coord").elements["i_center"].value = (this.i_max + this.i_min)/2;
        document.getElementById("coord").elements["zoom"].value = 3.0/(this.i_max - this.i_min);
        document.getElementById("coord").elements["image_w"].value = this.r_max - this.r_min;
        document.getElementById("coord").elements["image_h"].value = this.i_max - this.i_min;
    },

    show_image: function() {
        var image = new Image();
        image.src = this.canvas.toDataURL("image/png");
        document.getElementById('image').innerHTML='<img src="'+image.src+'">';
        document.getElementById("fractal").className = "invisible";
        document.getElementById("image").className = "visible";
    },

    show_canvas: function() {
        document.getElementById("fractal").className = "visible";
        document.getElementById("image").className = "invisible";
    }

}

