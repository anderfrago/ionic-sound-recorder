import { Component, OnInit } from '@angular/core';

import { Platform, AlertController, ToastController } from '@ionic/angular';
import { Media, MediaObject } from '@ionic-native/media/ngx';
import { File } from '@ionic-native/file/ngx';
import { Router } from '@angular/router';
import { ISong } from '../share/interfaces';
import { SongdbService } from '../core/songsdb.service';


@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
})
export class HomePage implements OnInit {

  recording: boolean = false;
  filePath: string;
  fileName: string;
  audio: MediaObject;
  audioList: ISong[] = [];

  data: ISong;

  constructor(
    private route: Router,
    private media: Media,
    private file: File,
    public platform: Platform,
    public alertController: AlertController,
    private songdbService: SongdbService) { }

  ngOnInit() {  }

  ionViewWillEnter(){
      // Clear previous values. We might came from player page after changing an audio name
      this.audioList = [];
      this.getAudioList();
  }
  getAudioList() {
    this.songdbService.getAll().then(
      data => {
        this.audioList = data
        console.log(this.audioList);
      });
  }

  startRecord() {
    if (this.platform.is('ios')) {
      this.fileName = 'audio' + new Date().getDay() + '' + new Date().getMonth() + new Date().getHours() + '' + new Date().getMinutes() + '' + new Date().getSeconds() + '.3gp';
      let filePath = this.file.documentsDirectory.replace(/file:\/\//g, '') + this.fileName;
      this.audio = this.media.create(filePath);
    } else if (this.platform.is('android')) {
      this.fileName = 'audio' + new Date().getDay() + '' + new Date().getMonth() + new Date().getHours() + '' + new Date().getMinutes() + '' + new Date().getSeconds() + '.3gp';
      let filePath = this.file.externalDataDirectory.replace(/file:\/\//g, '') + this.fileName;
      this.audio = this.media.create(filePath);
    }
    this.audio.startRecord();
    this.recording = true;
  }
  stopRecord(fileid, idx)  {
    this.audio.stopRecord();
    // IMP!! Need to be released for later remove
    this.audio.release();
    console.log('done recording' + this.fileName);
    let filePath: string = "";
    if (this.platform.is('ios')) {
      filePath = this.file.documentsDirectory.replace(/file:\/\//g, '') + this.fileName;
    } else if (this.platform.is('android')) {
      filePath = this.file.externalDataDirectory.replace(/file:\/\//g, '') + this.fileName;
    }
    this.data = {
      id: this.fileName,
      name: this.fileName,
    }
    this.songdbService.setItem(this.data.id, this.data);
    this.recording = false;
    this.audioList.push(this.data);
  }
  
  enterAudio(fileid, idx) {
    this.route.navigate(['/player', fileid]);
  }

  async deleteAudioConfirm(fileid, idx) {
    const alert = await this.alertController.create({
      header: 'Confirmación',
      message: '¿Eliminar audio?',
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel',
          cssClass: 'secondary',
          handler: (blah) => {
            console.log('Confirm Cancel: blah');
          }
        }, {
          text: 'Eliminar',
          handler: () => {
            console.log('Confirm Okay'); 
            this.songdbService.getItem(fileid).then(
              data => {
                // Delete element from list 
                this.audioList.forEach( 
                  (item,index) =>{
                    if(item.id === fileid)
                    {
                      this.audioList.splice(index, 1);
                    }
                });
              }
            );          
            // Delete element from database
            this.songdbService.remove(fileid);
            // Remove audio file from device
            this.deleteAudio(fileid, idx)
          }
        }
      ]
    });

    await alert.present();
  }


  deleteAudio(fileName, idx) {
    // Get location of audio files in device depending de device platform
    if (this.platform.is('ios')) {
      this.filePath = this.file.documentsDirectory;
    } else if (this.platform.is('android')) {
      this.filePath = this.file.externalDataDirectory;
    }
    // Check if file exists
    this.file.checkFile(this.filePath, fileName).then(data => {
      console.log("File exists" + data);
      // Remove file from device
      this.file.removeFile(this.filePath, fileName).then(data => {
        console.log('file removed: ' + fileName);
        data.fileRemoved.getMetadata(function (metadata) {
          let name = data.fileRemoved.name;
          let size = metadata.size;
          let fullPath = data.fileRemoved.fullPath;
          console.log('Deleted file: ' + name + size + fullPath);
          console.log('Name: ' + name + ' / Size: ' + size);

        });
      }).catch(error => {
        console.log('Error deleting file from cache folder: ' + error);
      });

    }).catch(error => {
      console.log('File not found: ' + error);
    });
  }

}
