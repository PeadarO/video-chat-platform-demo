import { Component, OnInit, ViewChild, ViewChildren, Injectable, HostListener } from '@angular/core';
import { ActivatedRoute, Params } from '@angular/router';
import { Subject, Observable, Observer } from 'rxjs';
import * as io from 'socket.io-client';
import { SafeResourceUrl, DomSanitizer } from '@angular/platform-browser';

import { WebRTCClient } from './webrtc-client.model';


@Component({
  selector: 'app-room',
  templateUrl: './room.component.html',
  styleUrls: ['./room.component.scss']
})
export class RoomComponent implements OnInit {
  roomId: number;
  socket: any;
  stream: any;

  peerId: string;
  private peerConnections: RTCPeerConnection[] = [];
  private myMediaStream: MediaStream = undefined;
  webrtcClients: WebRTCClient[] = [];
  @ViewChild('localVideo') localVideoRef: any;

  constructor(
    private route: ActivatedRoute,
    private sanitizer: DomSanitizer
  ) {
  }

  //listen if the browser closed or refreshed
  @HostListener('window:beforeunload', ['$event'])
  beforeUnloadHander(event) {
    this.socket.emit('room/leave');
  }

  //add remote url into white list
  public getVideoStreamURL(stream: MediaStream): SafeResourceUrl {
    return this.sanitizer.bypassSecurityTrustResourceUrl(URL.createObjectURL(stream));
  }

  ngOnInit() {
    this.socket = io("http://localhost:4201");
    this.getlocalstream();
  }

  //makeOffer (sdp offer)
  private makeOffer(clientId: string) {
    const peerConnection = this.getPeerConnection(clientId);
    console.log('makeOffer started');
    let socket = this.socket;
    console.log(this.socket);
    let peerId = this.peerId;
    peerConnection.createOffer(function(sessionDescription) {
      peerConnection.setLocalDescription(sessionDescription);
      console.log(sessionDescription);
      // POST-Offer-SDP-For-Other-Peer(sessionDescription.sdp, sessionDescription.type);

      socket.emit('msg', {
        by: peerId,
        to: clientId,
        sdp: sessionDescription.sdp,
        type: 'sdp.offer'
      })
      console.log('makeOffer ended');

    }, function(error) {
      alert(error);
    }, {
        offerToReceiveAudio: 1,
        offerToReceiveVideo: 1
      });
  }

  //local stream
  private getlocalstream() {
    let localVideo = this.localVideoRef.nativeElement;

    navigator.mediaDevices.getUserMedia({
      audio: true,
      video: true
    })
      .then((stream: MediaStream) => {
        this.myMediaStream = stream;
        console.log(stream);
        localVideo.srcObject = stream;
        localVideo.play();

        //listeners, make sure these will run after myMediaStream has something
        //get room id from the url
        this.route.params.subscribe((params) => {
          this.roomId = params['id'];
          this.enterRoom(this.roomId);
        });

        //get self id
        this.socket.on('selfid', (data) => {
          this.peerId = data;
        });

        //if received disconnected event
        this.socket.on('peer/disconnected', (data) => {
          //console.log(data);
          //console.log(this.webrtcClients);
          let index = -1;
          //delete disconnected client from the array
          for (let client of this.webrtcClients) {
            index = index + 1;
            if (data.id==client.getid())
              break;
          }
          if (index > -1) {
            this.webrtcClients.splice(index, 1);
          }
          //console.log(this.webrtcClients);
        });

        //if received connected event
        this.socket.on('peer/connected', (data) => {
          console.log('peer connected');
          if (data.roomid != this.roomId)
            return;
          //send sdp offer request
          this.makeOffer(data.id);
        });

        //handle msg: sdp offer/answer, ice
        this.socket.on('msg', (data) => {
          console.log('incoming message:');
          console.log(data);
          this.handleRTCPeerMessage(data);
        });
      })
      .catch(err => console.error('Can\'t get media stream', err));
  }


  private handleRTCPeerMessage(message) {
    const peerConnection = this.getPeerConnection(message.by);

    switch (message.type) {
      case 'sdp.offer':
        peerConnection
          .setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: message.sdp }))
          .then(() => {
            console.log('Setting remote description by offer');
            return peerConnection
              .createAnswer()
              .then((sdp: RTCSessionDescription) => {
                return peerConnection.setLocalDescription(sdp)
                  .then(() => {
                    this.socket.emit('msg', {
                      by: message.to,
                      to: message.by,
                      sdp: sdp,
                      type: 'sdp.answer'
                    });
                  })
              });
          })
          .catch(err => {
            console.error('Error on SDP-Offer:', err);
          });
        break;
      case 'sdp.answer':
        peerConnection
          .setRemoteDescription(new RTCSessionDescription(message.sdp))
          .then(() => console.log('Setting remote description by answer'))
          .catch(err => console.error('Error on SDP-Answer:', err));
        break;
      case 'ice':
        if (message.ice) {
          console.log('Adding ice candidate');
          peerConnection.addIceCandidate(message.ice);
        }
        break;
    }
  }


  private getPeerConnection(id): RTCPeerConnection {
    //if already exists, skip
    if (this.peerConnections[id]) {
      return this.peerConnections[id];
    }
    console.log(this.peerConnections);
    let peerConnection = new RTCPeerConnection({ iceServers: [{ 'urls': 'stun:stun.l.google.com:19302' }] });

    this.peerConnections[id] = peerConnection;
    console.log(this.peerConnections);
    peerConnection.onicecandidate = (event: RTCPeerConnectionIceEvent) => {
      console.log('onicecandidate');
      this.socket.emit('msg', {
        by: this.peerId,
        to: id,
        ice: event.candidate,
        type: 'ice'
      })
    };

    peerConnection.onnegotiationneeded = () => {
      console.log('Need negotiation:', id);
    }

    peerConnection.onsignalingstatechange = () => {
      console.log('ICE signaling state changed to:', peerConnection.signalingState, 'for client', id);
    }

    //after setRemoteDescription(), addStream() will be triggered
    peerConnection.addStream(this.myMediaStream);

    peerConnection.onaddstream = (event) => {
      console.log('Received new stream');
      const client = new WebRTCClient(id, event.stream);
      console.log(client);
      this.webrtcClients.push(client);
    }
    return peerConnection;
  }

  enterRoom(roomid: number) {
    let id = 2;
    this.socket.emit('room/enter', { room: roomid }, function(roomid, id) {
    });
  }

}
