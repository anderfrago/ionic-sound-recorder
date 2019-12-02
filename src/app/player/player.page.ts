import { Component, OnInit, OnDestroy } from '@angular/core';
import { Platform, AlertController, ToastController } from '@ionic/angular';
import { DatePipe } from '@angular/common';
import { MediaObject, Media } from '@ionic-native/media/ngx';
import { File } from '@ionic-native/file/ngx';
import { ActivatedRoute } from '@angular/router';
import { ISong } from '../share/interfaces';
import { SongdbService } from '../core/songsdb.service';


@Component({
  selector: 'app-player',
  templateUrl: './player.page.html',
  styleUrls: ['./player.page.scss'],
})
export class PlayerPage implements OnInit, OnDestroy {
 
  curr_playing_file: MediaObject;

  audio: ISong;
  name: string = "";
  // Inicialize playing audio values
  is_playing = false;
  is_in_play = false;
  is_ready = false;

  message: any;
  duration = -1;
  position = 0;

  get_duration_interval: any;
  get_position_interval: any;

  constructor(
    private route: ActivatedRoute,
    private file: File,
    private media: Media,
    public platform: Platform,
    public alertController: AlertController,
    private toastCtrl: ToastController,
    private datePipe: DatePipe,
    private songdbService: SongdbService) { }


  ngOnInit() {
    let id = this.route.snapshot.params.id;
    this.songdbService.getItem(id).then(
      data => {
        this.audio = data;
        this.name = data.name;
        this.getDurationAndSetToPlay();
      }
    );
  }

  ngOnDestroy(): void {
    this.  stopPlayRecording();
  }

  async editAudioName(fileid, idx){
    const alert = await this.alertController.create({
      header: 'Nombre',
      inputs: [
        {
          name: 'name',
          placeholder: this.name
        }
      ],
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel',
          handler: data => {
            console.log('Cancel clicked');
          }
        },
        {
          text: 'Aceptar',
          handler: data => {
            let auxSong: ISong = {
              id: this.audio.id,
              name: data.name,
            };
            this.songdbService.setItem(auxSong.id, auxSong);
            this.name = auxSong.name;
          }
        }
      ]
    });
    await alert.present();
  }
 
  getDurationAndSetToPlay() {
    let filePath:any;
    if (this.platform.is('ios')) {
      filePath = this.file.documentsDirectory.replace(/file:\/\//g, '') + this.audio.id;
    } else if (this.platform.is('android')) {
      filePath = this.file.externalDataDirectory.replace(/file:\/\//g, '') + this.audio.id;
    }
    this.curr_playing_file = this.media.create(filePath);

    this.curr_playing_file.play();
    this.curr_playing_file.setVolume(0.8); // you don't want users to notice that you are playing the file
    let self = this;
    this.get_duration_interval = setInterval(function () {
      if (self.duration == -1) {
        self.duration = ~~self.curr_playing_file.getDuration(); // make it an integer
      } else {
        self.curr_playing_file.stop();
        self.curr_playing_file.release();
        self.setRecordingToPlay();
        clearInterval(self.get_duration_interval);
      }
    }, 100);
  }

  setRecordingToPlay() {

    this.curr_playing_file.onStatusUpdate.subscribe(status => {
      // 2: playing
      // 3: pause
      // 4: stop
      this.message = status;
      switch (status) {
        case 1:
          this.is_in_play = false;
          break;
        case 2: // 2: playing
          this.is_in_play = true;
          this.is_playing = true;
          break;
        case 3: // 3: pause
          this.is_in_play = true;
          this.is_playing = false;
          break;
        case 4: // 4: stop
        default:
          this.is_in_play = false;
          this.is_playing = false;
          break;
      }
    });
    console.log('audio file set');
    this.message = 'audio file set';
    this.is_ready = true;
    //
    this.is_in_play = false;
    this.getAndSetCurrentAudioPosition();
  }
  getAndSetCurrentAudioPosition() {
    let diff = 1;
    let self = this;
    this.get_position_interval = setInterval(function () {
      let last_position = self.position;
      self.curr_playing_file.getCurrentPosition().then(position => {
        if (position >= 0 && position < self.duration) {
          if (Math.abs(last_position - position) >= diff) {
            // set position
            self.curr_playing_file.seekTo(last_position * 1000);
          } else {
            // update position for display
            self.position = position;
          }
        } else if (position >= self.duration) {
          self.stopPlayRecording();
          self.setRecordingToPlay();
        }
      });
    }, 100);
  }


  playRecording() {
    this.curr_playing_file.play();
    this.toastCtrl
      .create({
        message: `Comenzar desde ${this.fmtMSS(this.position)}`,
        duration: 2000
      })
      .then(toastEl => toastEl.present());
  }

  pausePlayRecording() {
    this.curr_playing_file.pause();
    this.toastCtrl
      .create({
        message: `Pausado en ${this.fmtMSS(this.position)}`,
        duration: 2000
      })
      .then(toastEl => toastEl.present());
  }

  stopPlayRecording() {
    this.curr_playing_file.stop();
    this.curr_playing_file.release();
    clearInterval(this.get_position_interval);
    this.position = 0;
  }

  controlSeconds(action) {
    let step = 15;

    let number = this.position;
    switch (action) {
      case 'back':
        this.position = number < step ? 0.001 : number - step;
        this.toastCtrl
          .create({
            message: `Rebobinar ${step} segundos`,
            duration: 2000
          })
          .then(toastEl => toastEl.present());
        break;
      case 'forward':
        this.position =
          number + step < this.duration ? number + step : this.duration;
        this.toastCtrl
          .create({
            message: `Adelante ${step} segundos`,
            duration: 2000
          })
          .then(toastEl => toastEl.present());
        break;
      default:
        break;
    }
  }

  fmtMSS(s) {
    return this.datePipe.transform(s * 1000, 'mm:ss');

    /** The following has been replaced with Angular DatePipe */
    // // accepts seconds as Number or String. Returns m:ss
    // return (
    //   (s - // take value s and subtract (will try to convert String to Number)
    //     (s %= 60)) / // the new value of s, now holding the remainder of s divided by 60
    //     // (will also try to convert String to Number)
    //     60 + // and divide the resulting Number by 60
    //   // (can never result in a fractional value = no need for rounding)
    //   // to which we concatenate a String (converts the Number to String)
    //   // who's reference is chosen by the conditional operator:
    //   (9 < s // if    seconds is larger than 9
    //     ? ':' // then  we don't need to prepend a zero
    //     : ':0') + // else  we do need to prepend a zero
    //   s
    // ); // and we add Number s to the string (converting it to String as well)
  }
}
