/*global AudioCompressor:false*/
/*jshint undef:false, unused:false*/
'use strict';
(function() {

  function readInputFile(file) {
    // disable conversion for the time of file loading

    // load file content
    var reader = new FileReader();
    reader.onload = function(e) {
      $('#convert').removeAttr('disabled');

      // convert(file.name, e.target.result);
      // return;

      var audioCompressor = new AudioCompressor({
        fileName: file.name,
        fileBuffer: e.target.result,
        format: 'mp3'
      });

      audioCompressor
        .on('ready', function(e) {
          $('#progress').removeClass('hidden');
        })
        .on('stdout', function(e) {
          console.log(e.data);
        })
        .on('stderr', function(e) {
          console.warn(e.data);
        })
        .on('progress', function(e, p) {
          $('#progress span').text(p);
          console.log('progress: ', p, '%');
        })
        // some kind of 'complete' event
        .on('done', function(e) {
          $('#progress').addClass('hidden');
          console.info('it is done!', e);
        })
        .on('success', function(e) {
          $('#download-link')
            .attr('href', e.data.url)
            .attr('download', e.data.name)
            .text('download ' + e.data.name)
            .removeClass('hidden');
        })
        .on('fail', function(e) {
          console.error('fail', e);
        })
        .on('abort', function(e, data) {
          console.error('aborted', data.message);

          var fakeData = {
            name: this.fileName,
            buffer: this.fileBuffer,
            blob: new Blob([this.fileBuffer], {type: this._getMimeType()})
          };

          fakeData.src = window.URL.createObjectURL(fakeData.blob);

          this.trigger('success', fakeData).trigger('done');
        })
        // start the conversion
        .convert();
    };
    reader.readAsArrayBuffer(file);
  }


  function handleFileSelect(event) {
    $('#download-link, #progress').addClass('hidden');

    var files = event.target.files; // FileList object

    // files is a FileList of File objects. display first file name
    var file = files[0];
    if (file) {
      readInputFile(file);
    }
  }

  // setup input file listeners
  document.getElementById('file').addEventListener('change', handleFileSelect, false);

})();
