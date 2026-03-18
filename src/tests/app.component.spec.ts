import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ServiceWorkerModule } from '@angular/service-worker';
import { AlertController } from '@ionic/angular';

import { AppComponent } from '../app/app.component';

describe('AppComponent', () => {

  beforeEach(async () => {
    const alertCtrlSpy = jasmine.createSpyObj('AlertController', ['create']);
    alertCtrlSpy.create.and.returnValue(Promise.resolve({ present: jasmine.createSpy() }));

    await TestBed.configureTestingModule({
      declarations: [AppComponent],
      imports: [ServiceWorkerModule.register('', { enabled: false })],
      providers: [
        { provide: AlertController, useValue: alertCtrlSpy },
      ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

});
