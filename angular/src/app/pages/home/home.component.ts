import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import * as io from 'socket.io-client';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent implements OnInit {
  private username: string;
  private roomid: number;
  socket: any;

  constructor(
    private router: Router
  ) { }

  ngOnInit() {
    
  }

  enter() {
    this.socket = io("http://localhost:4201");
    this.router.navigate(['room/' + this.roomid]);
  }
}
